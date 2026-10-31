import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export let supabaseConfigurationError = "";
let client = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  } catch (error) {
    supabaseConfigurationError =
      error instanceof Error ? error.message : "Cấu hình Supabase không hợp lệ.";
  }
}

export const supabaseConfigured = Boolean(client);
export const supabase = client;

export const defaultPosterPath = `${import.meta.env.BASE_URL}bhxh-guide-template.png`;
export const posterBucket = "poster-templates";
