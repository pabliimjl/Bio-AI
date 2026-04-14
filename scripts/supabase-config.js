import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FRONTEND_CONFIG } from "./app-config.js";

const proxyBaseUrl = normalizeProxyBaseUrl(FRONTEND_CONFIG.proxyBaseUrl || "");
const runtimeSupabaseConfig = await loadSupabaseRuntimeConfig();
const SUPABASE_URL = runtimeSupabaseConfig.url;
const SUPABASE_ANON_KEY = runtimeSupabaseConfig.anonKey;

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

async function loadSupabaseRuntimeConfig() {
  if (!proxyBaseUrl || proxyBaseUrl.includes("PEGA_AQUI")) {
    return { url: "", anonKey: "" };
  }

  try {
    const response = await fetch(`${proxyBaseUrl}/api/supabase-config`, {
      method: "GET",
    });

    if (!response.ok) {
      return { url: "", anonKey: "" };
    }

    const data = await response.json();
    return {
      url: String(data?.supabaseUrl || ""),
      anonKey: String(data?.supabaseAnonKey || ""),
    };
  } catch {
    return { url: "", anonKey: "" };
  }
}

function normalizeProxyBaseUrl(urlValue) {
  return (urlValue || "").trim().replace(/\/+$/, "");
}

export function getAppUrl(pathname = "index.html") {
  const url = new URL(window.location.href);
  const normalizedPath = url.pathname.endsWith("/") ? url.pathname : url.pathname.replace(/[^/]*$/, "");
  url.pathname = `${normalizedPath}${pathname}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}
