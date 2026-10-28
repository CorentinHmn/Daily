/**
 * Cadence — account creation. Creates the account already confirmed (no confirmation e-mail to wait for: the free
 * Supabase mailer is slow and rate-limited), with the first name in user_metadata. The app then signs in with the
 * password. An account alone opens nothing: every table is reserved to the members of a household (RLS), and a
 * household is only joined with its invite code.
 * Public (verify_jwt = false): it is called before any session exists. Answers { ok: true } or 4xx { error: code }.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'method' });

  let input: { email?: unknown; password?: unknown; name?: unknown };
  try {
    input = await req.json();
  } catch {
    return reply(400, { error: 'invalid_body' });
  }
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 40) : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return reply(400, { error: 'invalid_email' });
  if (password.length < 8 || password.length > 72) return reply(400, { error: 'weak_password' });
  if (!name) return reply(400, { error: 'name_required' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  if (error) {
    const code = (error as { code?: string }).code ?? '';
    if (code === 'email_exists' || code === 'user_already_exists' || /already (been )?registered|already exists/i.test(error.message)) return reply(409, { error: 'exists' });
    if (code === 'weak_password') return reply(400, { error: 'weak_password' });
    if (code === 'email_address_invalid' || code === 'validation_failed') return reply(400, { error: 'invalid_email' });
    console.error('createUser', code, error.message);
    return reply(500, { error: 'server' });
  }
  return reply(200, { ok: true });
});
