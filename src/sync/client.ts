/**
 * Supabase client. The project URL and its publishable key are public by design (they ship in the page; RLS guards the
 * data), so they are the defaults: the Vercel project needs no setting. VITE_SUPABASE_* override them (another project).
 * Implicit flow + detectSessionInUrl: the password-reset link carries its session in the URL hash, so it works even
 * when the iPhone opens it in Safari rather than in the home-screen app (PKCE would need the same browser).
 */
import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://dyqqvtpdttwzwkxtpzfp.supabase.co';
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || 'sb_publishable_shbyHvhOQo8fNdQaUZwkmw_8zd9Hbob';

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit', storageKey: 'cadence.auth' },
});
