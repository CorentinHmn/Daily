/**
 * Household sync with Supabase. The zustand store stays the source of the interface:
 *  - every local change is diffed record by record (records.ts) into an outbox, saved on the device, sent in batches
 *    (upsert); offline, it waits and leaves when the network is back;
 *  - changes of the other devices arrive by Realtime (filtered by household, RLS) and on catch-up pulls; they never
 *    overwrite a local change not sent yet; otherwise the last write wins;
 *  - sign-in = 6-digit code by e-mail (an iPhone home-screen app does not share Safari's storage, a link would open
 *    the session in Safari).
 */
import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './client';
import { applyRows, flatten, diff, keyOf, unflatten, type Change, type Flat, type Row } from './records';
import { useApp } from '../store/app';
import { emptyData } from '../domain/seed';
import { newMember } from '../domain/people';
import type { AppData, Member } from '../domain/types';
import { normalize } from '../lib/format';

export type SyncStatus = 'off' | 'signed-out' | 'no-household' | 'to-adopt' | 'connecting' | 'synced' | 'syncing' | 'offline' | 'error';

export interface Household {
  id: string;
  name: string;
  invite_code: string;
}

interface SyncState {
  status: SyncStatus;
  email: string | null;
  userId: string | null;
  household: Household | null;
  /** member id → account (user id) */
  linked: Record<string, string>;
  pending: number;
  lastSyncAt: number | null;
  error: string | null;
}

export const useSync = create<SyncState>(() => ({ status: supabase ? 'signed-out' : 'off', email: null, userId: null, household: null, linked: {}, pending: 0, lastSyncAt: null, error: null }));

// ── Device state: the household this device follows, the last change received, the changes not sent yet.
const LOCAL_KEY = 'cadence.sync';
const OUTBOX_KEY = 'cadence.outbox';
type Local = { householdId: string | null; lastPull: string | null };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
let local: Local = { householdId: null, lastPull: null, ...readJson<Partial<Local>>(LOCAL_KEY, {}) };
const outbox = new Map<string, Change>(readJson<Change[]>(OUTBOX_KEY, []).map((c) => [keyOf(c.collection, c.id), c]));

function saveLocal(): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
}
function saveOutbox(): void {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify([...outbox.values()]));
  useSync.setState({ pending: outbox.size });
}

let applying = false;
let current: Flat | null = null;
let unwatch: (() => void) | null = null;
let channel: RealtimeChannel | null = null;
let flushTimer = 0;

function watchStore(): void {
  unwatch?.();
  current = flatten(useApp.getState().data);
  unwatch = useApp.subscribe((s, prev) => {
    if (s.data === prev.data) return;
    const next = flatten(s.data);
    if (!applying && current) {
      const changes = diff(current, next);
      for (const c of changes) outbox.set(keyOf(c.collection, c.id), c);
      if (changes.length) {
        saveOutbox();
        scheduleFlush();
      }
    }
    current = next;
  });
}

function scheduleFlush(delay = 400): void {
  window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => void flush(), delay);
}

async function flush(): Promise<void> {
  if (!supabase || !local.householdId || outbox.size === 0) return;
  if (!navigator.onLine) {
    useSync.setState({ status: 'offline' });
    return;
  }
  const batch = [...outbox.values()].slice(0, 400);
  const sent = new Map(batch.map((c) => [keyOf(c.collection, c.id), JSON.stringify(c.data)]));
  useSync.setState({ status: 'syncing' });
  const { error } = await supabase
    .from('records')
    .upsert(
      batch.map((c) => ({ household_id: local.householdId, collection: c.collection, id: c.id, data: c.data, deleted: c.data === null })),
      { onConflict: 'household_id,collection,id' },
    );
  if (error) {
    useSync.setState({ status: navigator.onLine ? 'error' : 'offline', error: error.message });
    scheduleFlush(8000);
    return;
  }
  // Only what did not change again while it was being sent leaves the outbox.
  for (const [k, json] of sent) if (JSON.stringify(outbox.get(k)?.data) === json) outbox.delete(k);
  saveOutbox();
  useSync.setState({ status: 'synced', error: null, lastSyncAt: Date.now() });
  if (outbox.size) scheduleFlush(50);
}

async function pull(full: boolean): Promise<Row[]> {
  if (!supabase || !local.householdId) return [];
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from('records').select('collection,id,data,deleted,updated_at,updated_by').eq('household_id', local.householdId).order('updated_at').range(from, from + 999);
    if (!full && local.lastPull) q = q.gt('updated_at', local.lastPull);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function rememberPull(rows: Row[]): void {
  for (const r of rows) {
    const t = new Date(r.updated_at).toISOString();
    if (!local.lastPull || t > local.lastPull) local.lastPull = t;
  }
  saveLocal();
}

/** « Léa a coché « Lait » » when the other person ticks something. */
function announce(rows: Row[], before: Flat): void {
  const { userId, linked } = useSync.getState();
  const members = useApp.getState().data.members;
  const ticked = rows.filter((r) => {
    if (!r.updated_by || r.updated_by === userId || r.deleted) return false;
    const prev = before.get(keyOf(r.collection, r.id))?.data as { done?: boolean; checked?: boolean } | undefined;
    const now = r.data as { done?: boolean; checked?: boolean; title?: string; name?: string };
    return (r.collection === 'tasks' && now.done && !prev?.done) || (r.collection === 'items' && now.checked && !prev?.checked);
  });
  if (!ticked.length) return;
  const memberId = Object.entries(linked).find(([, u]) => u === ticked[0]!.updated_by)?.[0];
  const who = members.find((m) => m.id === memberId)?.name ?? 'Ton foyer';
  const first = ticked[0]!.data as { title?: string; name?: string };
  useApp.getState().toast({ tone: 'success', title: ticked.length > 1 ? `${who} a coché ${ticked.length} éléments` : `${who} a coché « ${first.title ?? first.name ?? ''} »` });
}

function applyRemote(rows: Row[], notify: boolean): void {
  if (!rows.length) return;
  const st = useApp.getState();
  const flat = flatten(st.data);
  if (notify) announce(rows, new Map(flat));
  const changed = applyRows(flat, rows, new Set(outbox.keys()));
  rememberPull(rows);
  if (!changed) return;
  applying = true;
  try {
    useApp.setState({ data: unflatten(st.data, flat) });
  } finally {
    applying = false;
  }
}

async function catchUp(): Promise<void> {
  try {
    await flush();
    applyRemote(await pull(false), false);
    await loadLinked();
    if (outbox.size === 0) useSync.setState({ status: 'synced', lastSyncAt: Date.now(), error: null });
  } catch (e) {
    useSync.setState({ status: navigator.onLine ? 'error' : 'offline', error: e instanceof Error ? e.message : String(e) });
  }
}

async function loadLinked(): Promise<void> {
  if (!supabase || !local.householdId) return;
  const { data } = await supabase.from('household_members').select('member_id,user_id').eq('household_id', local.householdId);
  if (data) useSync.setState({ linked: Object.fromEntries(data.map((r) => [r.member_id as string, r.user_id as string])) });
}

const onOnline = () => void catchUp();
const onVisible = () => {
  if (document.visibilityState === 'visible') void catchUp();
};

function subscribe(householdId: string): void {
  if (!supabase) return;
  if (channel) void supabase.removeChannel(channel);
  channel = supabase
    .channel(`records-${householdId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `household_id=eq.${householdId}` }, (payload) => {
      applyRemote([payload.new as Row], true);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') void catchUp();
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') useSync.setState({ status: navigator.onLine ? 'error' : 'offline' });
    });
}

async function attach(h: Household): Promise<void> {
  local.householdId = h.id;
  saveLocal();
  useSync.setState({ household: h, status: navigator.onLine ? 'connecting' : 'offline' });
  watchStore();
  subscribe(h.id);
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  await catchUp();
}

function detach(): void {
  unwatch?.();
  unwatch = null;
  if (channel && supabase) void supabase.removeChannel(channel);
  channel = null;
  window.removeEventListener('online', onOnline);
  document.removeEventListener('visibilitychange', onVisible);
}

interface Membership {
  member_id: string;
  household: Household;
}

async function fetchMembership(): Promise<Membership | null> {
  if (!supabase) return null;
  const userId = useSync.getState().userId ?? (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return null;
  // RLS also shows the other members' rows of the household: keep mine.
  const { data, error } = await supabase.from('household_members').select('member_id, households(id,name,invite_code)').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const h = (Array.isArray(data.households) ? data.households[0] : data.households) as Household | undefined;
  return h ? { member_id: data.member_id as string, household: h } : null;
}

/** After sign-in or at start: follows the household if this device already does, otherwise says what is missing. */
async function resolve(): Promise<void> {
  const m = await fetchMembership();
  if (!m) {
    useSync.setState({ status: 'no-household', household: null });
    return;
  }
  if (m.household.id === local.householdId) await attach(m.household);
  else useSync.setState({ status: 'to-adopt', household: m.household });
}

/** At app start. Offline with a known household: changes are queued until the network is back. */
export async function initSync(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) {
    useSync.setState({ status: 'signed-out' });
    return;
  }
  useSync.setState({ email: session.user.email ?? null, userId: session.user.id });
  try {
    await resolve();
  } catch {
    if (local.householdId) {
      watchStore();
      useSync.setState({ status: 'offline' });
      window.addEventListener('online', () => void resolve().catch(() => undefined), { once: true });
    }
  }
}

export async function sendCode(email: string): Promise<void> {
  if (!supabase) throw new Error('Synchronisation non configurée');
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyCode(email: string, code: string): Promise<void> {
  if (!supabase) throw new Error('Synchronisation non configurée');
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.replace(/\D/g, ''), type: 'email' });
  if (error) throw error;
  useSync.setState({ email: data.user?.email ?? email, userId: data.user?.id ?? null });
  await resolve();
}

/** Creates the household with this device's data (everything is uploaded). */
export async function createHousehold(name: string): Promise<void> {
  if (!supabase) return;
  const meId = useApp.getState().data.settings.meId;
  const { data, error } = await supabase.rpc('create_household', { p_member_id: meId, p_name: name });
  if (error) throw error;
  const h = data as Household;
  local = { householdId: h.id, lastPull: null };
  outbox.clear();
  for (const r of flatten(useApp.getState().data).values()) outbox.set(keyOf(r.collection, r.id), { collection: r.collection, id: r.id, data: r.data });
  saveOutbox();
  await attach(h);
}

/** Replaces this device's data with the household's (new device of a member, or a member who just joined). */
async function adopt(h: Household, me: string, newcomer?: { id: string; name: string }): Promise<void> {
  if (!supabase) return;
  detach();
  local = { householdId: h.id, lastPull: null };
  outbox.clear();
  saveOutbox();
  const rows = await pull(true);
  rememberPull(rows);
  const flat: Flat = new Map();
  applyRows(flat, rows);
  const st = useApp.getState();
  const base: AppData = { ...emptyData(), onboarded: true, settings: { ...st.data.settings }, active: st.data.active };
  const data = unflatten(base, flat);
  let meId = me;
  if (newcomer) {
    await loadLinked();
    const taken = new Set(Object.keys(useSync.getState().linked));
    // A person already created for her (tasks assigned to « Léa ») is taken over; otherwise a new person.
    const same = data.members.find((m) => normalize(m.name) === normalize(newcomer.name) && !taken.has(m.id));
    if (same) {
      const { error } = await supabase.rpc('claim_member', { p_member_id: same.id });
      if (error) throw error;
      meId = same.id;
    } else {
      const m: Member = { ...newMember(newcomer.name, data.members), id: newcomer.id };
      data.members = [...data.members, m];
      meId = m.id;
      outbox.set(keyOf('members', m.id), { collection: 'members', id: m.id, data: m });
      saveOutbox();
    }
  }
  const myName = data.members.find((m) => m.id === meId)?.name ?? data.settings.name;
  const next = { ...data, settings: { ...data.settings, meId, name: myName } };
  applying = true;
  try {
    useApp.setState({ data: next, person: next.members.length > 1 ? meId : null, dialog: null });
  } finally {
    applying = false;
  }
  await attach(h);
}

/** Joins with the invite code under one's first name. */
export async function joinHousehold(code: string, name: string): Promise<void> {
  if (!supabase) return;
  const id = `m-${Math.random().toString(36).slice(2, 10)}`;
  const { data, error } = await supabase.rpc('join_household', { p_code: code, p_member_id: id });
  if (error) throw error;
  await adopt(data as Household, id, { id, name });
}

/** This account is in a household this device does not follow yet. */
export async function adoptHousehold(): Promise<void> {
  const m = await fetchMembership();
  if (!m) throw new Error('Aucun foyer pour ce compte');
  await adopt(m.household, m.member_id);
}

export async function signOut(): Promise<void> {
  detach();
  await supabase?.auth.signOut();
  local = { householdId: null, lastPull: null };
  saveLocal();
  outbox.clear();
  saveOutbox();
  useSync.setState({ status: 'signed-out', email: null, userId: null, household: null, linked: {}, error: null });
}

export async function renameHousehold(name: string): Promise<void> {
  const h = useSync.getState().household;
  if (!supabase || !h) return;
  const { error } = await supabase.from('households').update({ name }).eq('id', h.id);
  if (error) throw error;
  useSync.setState({ household: { ...h, name } });
}
