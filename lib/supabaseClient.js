import { createClient } from "@supabase/supabase-js";

let cachedClient = null;

export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!cachedClient) {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return cachedClient;
}

export function getSupabaseBucket() {
  return process.env.SUPABASE_BUCKET || "mesaza_public";
}
