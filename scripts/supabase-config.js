import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://krdzhlsveetzcafurnqd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyZHpobHN2ZWV0emNhZnVybnFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMjk3NjYsImV4cCI6MjA5MTcwNTc2Nn0.50cV6-Q6k30tgHOoSht3Vod9vwvzSC7zuIkLvrW2RdE";

export function isSupabaseConfigured() {
  return (
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("TU-PROYECTO") &&
    SUPABASE_ANON_KEY.startsWith("eyJ")
  );
}

export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function getAppUrl(pathname = "index.html") {
  const url = new URL(window.location.href);
  const normalizedPath = url.pathname.endsWith("/") ? url.pathname : url.pathname.replace(/[^/]*$/, "");
  url.pathname = `${normalizedPath}${pathname}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}
