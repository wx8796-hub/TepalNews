import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = typeof url === "string" && typeof anonKey === "string"
  ? createClient(url, anonKey)
  : (null as unknown as ReturnType<typeof createClient>)
