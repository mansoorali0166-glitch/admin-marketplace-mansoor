import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
const makeClient = (storageKey) => supabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey },
    })
  : null;
const makeRecoveryClient = () => supabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;

export const adminSupabase = makeClient('marketplace-admin-auth');
export const adminRecoverySupabase = makeRecoveryClient();
export const sellerSupabase = makeClient('marketplace-seller-auth');
export const agentSupabase = makeClient('marketplace-agent-auth');
const currentPath = window.location.pathname.toLowerCase();
export const supabase = currentPath.startsWith('/seller')
  ? sellerSupabase
  : currentPath.startsWith('/agent')
    ? agentSupabase
    : adminSupabase;
