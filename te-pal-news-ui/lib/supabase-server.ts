import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (process.env.NODE_ENV === "development") {
  try {
    if (url) console.log("[Supabase server] URL domain:", new URL(url).hostname)
    else console.warn("[Supabase server] NEXT_PUBLIC_SUPABASE_URL is missing or empty")
    if (serviceKey) console.log("[Supabase server] SUPABASE_SERVICE_ROLE_KEY length:", serviceKey.length)
    else console.warn("[Supabase server] SUPABASE_SERVICE_ROLE_KEY is missing or empty")
  } catch {
    console.warn("[Supabase server] Invalid SUPABASE URL")
  }
}

export const supabaseAdmin = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false } })
  : null
