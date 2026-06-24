import { createClient } from "@supabase/supabase-js";

// Reads from Vite env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) with the current
// publishable values as fallback so the app runs out-of-the-box. Set the env vars in
// Netlify (Site settings -> Environment) for production.
const SB_URL = import.meta.env.VITE_SUPABASE_URL || "https://vhzeeskhvkujihuvddcc.supabase.co";
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_BrMb59PYqV2W7DPbRe_L6g_7I2mqAt_";

export const sb = createClient(SB_URL, SB_KEY);
