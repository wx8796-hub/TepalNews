import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hasEnv = typeof url === "string" && url.length > 0 && typeof anonKey === "string" && anonKey.length > 0

export const supabase = hasEnv
  ? createClient(url as string, anonKey as string)
  : (null as unknown as ReturnType<typeof createClient>)
