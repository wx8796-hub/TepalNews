import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hasEnv = typeof url === "string" && url.length > 0 && typeof anonKey === "string" && anonKey.length > 0

/** Workaround for LockManager timeout. See: supabase/supabase-js#1594 */
const noOpLock = async (
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<unknown>
): Promise<unknown> => fn()

let _client: SupabaseClient | null = null

function createSupabaseClient(urlStr: string, anonKeyStr: string): SupabaseClient {
  return createClient(urlStr, anonKeyStr, { auth: { lock: noOpLock } })
}

// 배포 환경에서 빌드 시 env가 번들에 있으면 브라우저에서 즉시 클라이언트 생성 (effect 순서 의존 제거)
if (typeof window !== "undefined" && hasEnv) {
  _client = createSupabaseClient(url as string, anonKey as string)
}

function getSupabaseSync(): SupabaseClient | null {
  if (!hasEnv) {
    if (typeof window !== "undefined") {
      console.warn("[Supabase] No build-time env; client will try /api/config/supabase at runtime.")
    }
    return null
  }
  if (typeof window === "undefined") return null
  if (!_client) {
    _client = createSupabaseClient(url as string, anonKey as string)
    if (process.env.NODE_ENV === "development") {
      try {
        console.log("[Supabase] Client created from env. URL:", new URL(url as string).hostname)
      } catch {
        console.warn("[Supabase] Could not log URL (invalid?)")
      }
    }
  }
  return _client
}

/**
 * Returns the Supabase client. Use this instead of the `supabase` export so that
 * runtime config (from /api/config/supabase) is used when build-time env is missing (e.g. Vercel).
 */
export function getSupabase(): SupabaseClient | null {
  if (_client) return _client
  return getSupabaseSync()
}

/**
 * When build-time env is missing (e.g. after deploy), fetches config from API and creates the client.
 * Call once on app init (e.g. in AuthProvider) when getSupabase() is null.
 * Uses bundle URL (NEXT_PUBLIC_SUPABASE_URL) when API doesn't return url — so "Host" can show but anon key from API.
 */
export async function ensureSupabaseFromApi(): Promise<SupabaseClient | null> {
  if (_client) return _client
  if (typeof window === "undefined") return null

  const bundleUrl =
    typeof process !== "undefined" &&
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : null

  const tryFetch = async (): Promise<SupabaseClient | null> => {
    const base = typeof window !== "undefined" ? window.location.origin : ""
    const res = await fetch(`${base}/api/config/supabase`, { cache: "no-store" })
    let data: { configured?: boolean; url?: string; anonKey?: string; missing?: string[]; hint?: string } | null = null
    try {
      data = await res.json()
    } catch {
      console.warn("[Supabase] /api/config/supabase not JSON, status:", res.status)
      return null
    }
    const url = data?.url || bundleUrl
    const anonKey = data?.anonKey
    if (url && anonKey) {
      _client = createSupabaseClient(url, anonKey)
      if (typeof window !== "undefined") {
        console.info("[Supabase] Client created from /api/config/supabase")
      }
      return _client
    }
    if (!res.ok && typeof window !== "undefined") {
      console.warn("[Supabase] config API", res.status, data?.missing ? { missing: data.missing } : data?.hint ?? "")
    }
    return null
  }

  try {
    let client = await tryFetch()
    if (!client) {
      await new Promise((r) => setTimeout(r, 400))
      client = await tryFetch()
    }
    if (!client && hasEnv) client = getSupabaseSync()
    return client
  } catch (e) {
    console.error("[Supabase] ensureSupabaseFromApi failed", e)
    if (hasEnv) return getSupabaseSync()
    return null
  }
}

