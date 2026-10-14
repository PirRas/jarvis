"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Projektadresse und Publishable Key aus dem Supabase-Dashboard (Project Settings > API Keys).
// Beide sind für den Browser gedacht und dürfen öffentlich sein; der Zugriff wird über RLS geschützt.
// Niemals den secret / service_role key hier eintragen.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const syncConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

let client: SupabaseClient | null = null;

export function supabase() {
  if (!syncConfigured) return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
