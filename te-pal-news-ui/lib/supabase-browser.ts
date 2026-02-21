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

function getSupabase(): SupabaseClient | null {
  if (!hasEnv) {
    if (typeof window !== "undefined") {
      const u = process.env.NEXT_PUBLIC_SUPABASE_URL
      const a = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      console.error("[Supabase] Missing env: URL=", u ? new URL(u as string).hostname : "undefined", "anonKey length=", typeof a === "string" ? a.length : 0)
    }
    return null
  }
  if (typeof window === "undefined") return null
  if (!_client) {
    _client = createClient(url as string, anonKey as string, { auth: { lock: noOpLock } })
    if (process.env.NODE_ENV === "development") {
      try {
        const u = process.env.NEXT_PUBLIC_SUPABASE_URL
        console.log("[Supabase] Client created. URL domain:", u ? new URL(u as string).hostname : "?", "anonKey length:", (anonKey as string).length)
      } catch {
        console.warn("[Supabase] Could not log URL (invalid?)")
      }
    }
  }
  return _client
}

/** Only created in the browser to avoid Navigator LockManager / lock timeout on server. */
export const supabase = getSupabase()
