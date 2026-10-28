/**
 * Account and household sync with Supabase. Signing in is required: the app opens on the sign-in screen, then on the
 * household setup (create it or join it with its code), then on the household's data.
 *  - the zustand store stays the source of the interface; it is kept on the device (localStorage), so the app opens
 *    instantly and works offline;
 *  - every local change is diffed record by record (records.ts) into an outbox, saved on the device, sent in batches
 *    (upsert); offline, it waits and leaves when the network is back;
 *  - changes of the other devices arrive by Realtime (filtered by household, RLS) and on catch-up pulls; they never
 *    overwrite a local change not sent yet; otherwise the last write wins;
 *  - accounts: e-mail + password. Creating one goes through the `signup` Edge Function (account confirmed at once,
 *    no e-mail to wait for); a forgotten password is reset by an e-mail link that comes back to the site.
 */
import { create } from 'zustand';
import type { RealtimeChannel, User } from '@supabase/supabase-js';
import { supabase } from './client';
import { applyRows, flatten, diff, keyOf, unflatten, type Change, type Flat, type Row } from './records';
import { useApp } from '../store/app';
import { emptyData } from '../domain/seed';
import { newMember } from '../domain/people';
import type { AppData, Member } from '../domain/types';
import { normalize } from '../lib/format';

export type SyncStatus =
  /** session being read */
  | 'loading'
  | 'signed-out'
  /** came back from the password-reset e-mail: choose a new password */
  | 'recovery'
  | 'no-household'
  /** signed in, nothing on this device yet and the server cannot be reached */
  | 'unreachable'
  | 'connecting'
  | 'synced'
  | 'syncing'
  | 'offline'
  | 'error';

export interface Household {
  id: string;
  name: string;
  invite_code: string;
}

interface SyncState {
  status: SyncStatus;
  email: string | null;
  userId: string | null;
  /** first name given when the account was created */
  firstName: string;
  household: Household | null;
  /** member id → account (user id) */
  linked: Record<string, string>;
  pending: number;
  lastSyncAt: number | null;
  /** at least one pull went through since the app started: the new week can be filled without stale data */
  caughtUp: boolean;
  error: string | null;
  /** message for the sign-in screen (expired link…) */
  notice: string | null;
}

// The URL as the page opened it: the reset-password link (#…type=recovery) or an expired link (#error=…). Read now,
// before the Supabase client cleans the hash.
const opened = new URLSearchParams(window.location.hash.slice(1));
const openedForRecovery = opened.get('type') === 'recovery';
const openedWithError = opened.get('error_description');

export const useSync = create<SyncState>(() => ({
  status: 'loading',
  email: null,
  userId: null,
  firstName: '',
  household: null,
  linked: {},
  pending: 0,
  lastSyncAt: null,
  caughtUp: false,
  error: null,
  notice: openedWithError ? 'Ce lien a expiré ou a déjà servi. Redemande un e-mail.' : null,
}));

// ── Device state: the account and household this device follows, the last change received, the changes not sent yet.
const LOCAL_KEY = 'cadence.sync';
const OUTBOX_KEY = 'cadence.outbox';
type Local = { userId: string | null; householdId: string | null; household: Household | null; lastPull: string | null };
const NO_LOCAL: Local = { userId: null, householdId: null, household: null, lastPull: null };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
let local: Local = { ...NO_LOCAL, ...readJson<Partial<Local>>(LOCAL_KEY, {}) };
const outbox = new Map<string, Change>(readJson<Change[]>(OUTBOX_KEY, []).map((c) => [keyOf(c.collection, c.id), c]));

function saveLocal(): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
  } catch {
    // storage full or blocked: the app still works, it will catch up from the server next time
  }
}
function saveOutbox(): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify([...outbox.values()]));
  } catch {
    // same
  }
  useSync.setState({ pending: outbox.size });
}

let applying = false;
let current: Flat | null = null;
let unwatch: (() => void) | null = null;
let channel: RealtimeChannel | null = null;
let flushTimer = 0;

/** Replaces the store's data without sending it back (it comes from the server, or is being forgotten). */
function replaceData(fn: () => void): void {
  applying = true;
  try {
    fn();
  } finally {
    applying = false;
  }
}

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
  if (!local.householdId || outbox.size === 0) return;
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
  if (!local.householdId) return [];
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
async function announce(rows: Row[], before: Flat): Promise<void> {
  const { userId } = useSync.getState();
  const ticked = rows.filter((r) => {
    if (!r.updated_by || r.updated_by === userId || r.deleted) return false;
    const prev = before.get(keyOf(r.collection, r.id))?.data as { done?: boolean; checked?: boolean } | undefined;
    const now = r.data as { done?: boolean; checked?: boolean; title?: string; name?: string };
    return (r.collection === 'tasks' && now.done && !prev?.done) || (r.collection === 'items' && now.checked && !prev?.checked);
  });
  if (!ticked.length) return;
  const author = ticked[0]!.updated_by;
  // Someone who joined since the accounts were last read: read them again to name them.
  if (!Object.values(useSync.getState().linked).includes(author!)) await loadLinked().catch(() => undefined);
  const memberId = Object.entries(useSync.getState().linked).find(([, u]) => u === author)?.[0];
  const who = useApp.getState().data.members.find((m) => m.id === memberId)?.name ?? 'Ton foyer';
  const first = ticked[0]!.data as { title?: string; name?: string };
  useApp.getState().toast({ tone: 'success', title: ticked.length > 1 ? `${who} a coché ${ticked.length} éléments` : `${who} a coché « ${first.title ?? first.name ?? ''} »` });
}

function applyRemote(rows: Row[], notify: boolean): void {
  if (!rows.length) return;
  const st = useApp.getState();
  const flat = flatten(st.data);
  if (notify) void announce(rows, new Map(flat));
  const changed = applyRows(flat, rows, new Set(outbox.keys()));
  rememberPull(rows);
  // A new person in the household: their account is linked now (« Compte relié »).
  if (rows.some((r) => r.collection === 'members')) void loadLinked().catch(() => undefined);
  if (!changed) return;
  replaceData(() => useApp.setState({ data: unflatten(st.data, flat) }));
}

async function catchUp(): Promise<void> {
  try {
    await flush();
    applyRemote(await pull(false), false);
    await loadLinked();
    useSync.setState({ caughtUp: true });
    if (outbox.size === 0) useSync.setState({ status: 'synced', lastSyncAt: Date.now(), error: null });
  } catch (e) {
    useSync.setState({ status: navigator.onLine ? 'error' : 'offline', error: e instanceof Error ? e.message : String(e) });
  }
}

async function loadLinked(): Promise<void> {
  if (!local.householdId) return;
  const { data } = await supabase.from('household_members').select('member_id,user_id').eq('household_id', local.householdId);
  if (data) useSync.setState({ linked: Object.fromEntries(data.map((r) => [r.member_id as string, r.user_id as string])) });
}

const onOnline = () => void catchUp();
const onVisible = () => {
  if (document.visibilityState === 'visible') void catchUp();
};

function subscribe(householdId: string): void {
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
  local.household = h;
  local.userId = useSync.getState().userId;
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
  current = null;
  if (channel) void supabase.removeChannel(channel);
  channel = null;
  window.clearTimeout(flushTimer);
  window.removeEventListener('online', onOnline);
  document.removeEventListener('visibilitychange', onVisible);
}

/** Forgets the household's data on this device (sign-out, removed from the household, another account). */
function forgetDevice(): void {
  detach();
  local = { ...NO_LOCAL };
  saveLocal();
  outbox.clear();
  saveOutbox();
  replaceData(() => useApp.getState().reset());
  useSync.setState({ household: null, linked: {}, caughtUp: false, lastSyncAt: null, error: null });
}

interface Membership {
  member_id: string;
  household: Household;
}

async function fetchMembership(): Promise<Membership | null> {
  const userId = useSync.getState().userId;
  if (!userId) return null;
  // RLS also shows the other members' rows of the household: keep mine.
  const { data, error } = await supabase.from('household_members').select('member_id, households(id,name,invite_code)').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const h = (Array.isArray(data.households) ? data.households[0] : data.households) as Household | undefined;
  return h ? { member_id: data.member_id as string, household: h } : null;
}

/** This device holds this account's household already (its copy can be shown before the server answers). */
function deviceFollows(householdId?: string): boolean {
  return !!local.householdId && local.userId === useSync.getState().userId && useApp.getState().data.onboarded && (!householdId || householdId === local.householdId);
}

/** After sign-in, or at start: the household of the account, fetched on this device if it is not there yet. */
async function resolve(): Promise<void> {
  const m = await fetchMembership();
  if (!m) {
    if (local.householdId || useApp.getState().data.onboarded) forgetDevice();
    useSync.setState({ status: 'no-household' });
    return;
  }
  if (deviceFollows(m.household.id)) await attach(m.household);
  else await adopt(m.household, m.member_id);
}

function setUser(user: User | null): void {
  const name = (user?.user_metadata as { name?: string } | undefined)?.name;
  useSync.setState({ email: user?.email ?? null, userId: user?.id ?? null, firstName: typeof name === 'string' ? name : '' });
}

let started = false;

/** At app start. Offline with this account's household on the device: the app opens, changes wait for the network. */
export async function initSync(): Promise<void> {
  if (started) return;
  started = true;
  supabase.auth.onAuthStateChange((event, session) => {
    // No Supabase call in here (it would wait on the auth lock): only state.
    if (event === 'PASSWORD_RECOVERY') useSync.setState({ status: 'recovery' });
    if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') setUser(session?.user ?? null);
    if (event === 'SIGNED_OUT' && useSync.getState().status !== 'signed-out') {
      forgetDevice();
      setUser(null);
      useSync.setState({ status: 'signed-out' });
    }
  });
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) {
    if (local.householdId || useApp.getState().data.onboarded) forgetDevice();
    useSync.setState({ status: 'signed-out' });
    return;
  }
  setUser(session.user);
  if (openedForRecovery) {
    useSync.setState({ status: 'recovery' });
    return;
  }
  await open();
}

/** Shows the household: at once from this device's copy (then checked with the server), else from the server. */
async function open(): Promise<void> {
  if (deviceFollows() && local.household) {
    void attach(local.household);
    void recheck();
    return;
  }
  try {
    await resolve();
  } catch {
    useSync.setState({ status: 'unreachable' });
  }
}

/** The household seen from the server: renamed, left, or another one. */
async function recheck(): Promise<void> {
  try {
    const m = await fetchMembership();
    if (!m) {
      forgetDevice();
      useSync.setState({ status: 'no-household' });
    } else if (m.household.id !== local.householdId) {
      await adopt(m.household, m.member_id);
    } else {
      local.household = m.household;
      saveLocal();
      useSync.setState({ household: m.household });
    }
  } catch {
    // offline: the copy on the device stays in use
  }
}

/** « Réessayer » of the unreachable screen. */
export async function retry(): Promise<void> {
  useSync.setState({ status: 'loading' });
  await open();
}

// ── Account ─────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string): Promise<void> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  setUser(data.user);
  useSync.setState({ notice: null });
  await open();
}

/** Creates a confirmed account (Edge Function `signup`), then signs in with it. */
export async function signUp(firstName: string, email: string, password: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>('signup', { body: { name: firstName.trim(), email: email.trim(), password } });
  if (error) {
    // The function answers 4xx with { error: code }: read it from the response.
    const ctx = (error as { context?: Response }).context;
    const body = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => null)) as { error?: string } | null) : null;
    throw new Error(body?.error ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
  await signIn(email, password);
}

/** E-mail with a link back to the site, where a new password is chosen (status « recovery »). */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/` });
  if (error) throw error;
}

export async function changePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/** New password after the reset link, then on to the household. */
export async function finishRecovery(password: string): Promise<void> {
  await changePassword(password);
  useSync.setState({ status: 'loading' });
  await open();
}

export async function signOut(): Promise<void> {
  // Changes not sent yet leave first when the network allows it.
  if (outbox.size && navigator.onLine) await flush().catch(() => undefined);
  forgetDevice();
  await supabase.auth.signOut().catch(() => undefined);
  setUser(null);
  useSync.setState({ status: 'signed-out' });
}

// ── Household ───────────────────────────────────────────────────────────────

/** Creates the household with the data just prepared on this device (start or import): everything is uploaded. */
export async function createHousehold(name: string): Promise<void> {
  const meId = useApp.getState().data.settings.meId;
  const { data, error } = await supabase.rpc('create_household', { p_member_id: meId, p_name: name });
  if (error) throw error;
  const h = data as Household;
  local = { ...NO_LOCAL, userId: useSync.getState().userId, householdId: h.id, household: h };
  outbox.clear();
  for (const r of flatten(useApp.getState().data).values()) outbox.set(keyOf(r.collection, r.id), { collection: r.collection, id: r.id, data: r.data });
  saveOutbox();
  await attach(h);
}

/** Replaces this device's data with the household's (new device of a member, or a member who just joined). */
async function adopt(h: Household, me: string, newcomer?: { id: string; name: string }): Promise<void> {
  detach();
  local = { ...NO_LOCAL, userId: useSync.getState().userId, householdId: h.id, household: h };
  outbox.clear();
  saveOutbox();
  const rows = await pull(true);
  rememberPull(rows);
  const flat: Flat = new Map();
  applyRows(flat, rows);
  const st = useApp.getState();
  const base: AppData = { ...emptyData(), onboarded: true, settings: { ...emptyData().settings, theme: st.data.settings.theme } };
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
  const myName = data.members.find((m) => m.id === meId)?.name ?? useSync.getState().firstName;
  const next = { ...data, settings: { ...data.settings, meId, name: myName } };
  replaceData(() => useApp.setState({ data: next, person: next.members.length > 1 ? meId : null, programId: next.programs[0]?.id ?? null, dialog: null }));
  await attach(h);
}

/** Joins with the invite code under one's first name. */
export async function joinHousehold(code: string, name: string): Promise<void> {
  const id = `m-${Math.random().toString(36).slice(2, 10)}`;
  const { data, error } = await supabase.rpc('join_household', { p_code: code, p_member_id: id });
  if (error) throw error;
  await adopt(data as Household, id, { id, name });
}

/** After an import, this account is the imported data's « moi » (the file brings its own people). */
export async function relinkMe(): Promise<void> {
  const meId = useApp.getState().data.settings.meId;
  if (!meId || !local.householdId) return;
  const { error } = await supabase.rpc('claim_member', { p_member_id: meId });
  if (error) throw error;
  await loadLinked();
}

export async function renameHousehold(name: string): Promise<void> {
  const h = useSync.getState().household;
  if (!h) return;
  const { error } = await supabase.from('households').update({ name }).eq('id', h.id);
  if (error) throw error;
  local.household = { ...h, name };
  saveLocal();
  useSync.setState({ household: { ...h, name } });
}

// ── Invitation link: https://…/?invite=ABCD1234 opens the sign-up, then the household setup with the code filled in.
const INVITE_KEY = 'cadence.invite';
const invited = new URLSearchParams(window.location.search).get('invite');
if (invited) {
  try {
    sessionStorage.setItem(INVITE_KEY, invited.replace(/\W/g, '').toUpperCase().slice(0, 8));
  } catch {
    // the code can still be typed
  }
  const url = new URL(window.location.href);
  url.searchParams.delete('invite');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

export function pendingInvite(): string | null {
  try {
    return sessionStorage.getItem(INVITE_KEY);
  } catch {
    return null;
  }
}

export function clearInvite(): void {
  try {
    sessionStorage.removeItem(INVITE_KEY);
  } catch {
    // nothing to clear
  }
}

export const inviteLink = (code: string) => `${window.location.origin}/?invite=${code}`;
export const formatCode = (c: string) => (c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c);
