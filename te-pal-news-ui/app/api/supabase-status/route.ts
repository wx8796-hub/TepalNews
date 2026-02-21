import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

/** GET /api/supabase-status — DB 연결 여부 확인 (env 누락 시 원인 표시) */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const hasUrl = typeof url === "string" && url.length > 0
  const hasAnonKey = typeof anonKey === "string" && anonKey.length > 0
  const hasServiceKey = typeof serviceKey === "string" && serviceKey.length > 0

  if (!supabaseAdmin) {
    const missing: string[] = []
    if (!hasUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL")
    if (!hasAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if (!hasServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY")
    return NextResponse.json({
      ok: false,
      message: "Supabase not configured",
      missing: missing.length ? missing : [".env.local not loaded or empty values"],
      hint: "Add the missing vars to te-pal-news-ui/.env.local and restart: npm run dev",
    })
  }

  try {
    const { error } = await supabaseAdmin.from("posts_feed").select("id").limit(1)
    if (error) {
      return NextResponse.json({
        ok: false,
        message: "Connected but query failed (schema may be missing)",
        error: error.message,
        hint: "Run supabase-schema-v1.sql in Supabase SQL Editor",
      })
    }
    return NextResponse.json({ ok: true, message: "Database connected" })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      message: "Connection check failed",
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
