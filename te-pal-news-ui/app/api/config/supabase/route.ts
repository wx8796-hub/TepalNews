import { NextResponse } from "next/server"

/** Always read env at request time (no cache). */
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store, max-age=0" }

/**
 * Returns Supabase URL and anon key at runtime so the client can connect
 * when NEXT_PUBLIC_* were not available at build time (e.g. Vercel deploy with env added later).
 * Anon key is public by design; only call from client when getSupabase() is null.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const ok =
    typeof url === "string" &&
    url.length > 0 &&
    typeof anonKey === "string" &&
    anonKey.length > 0
  if (!ok) {
    return NextResponse.json(
      {
        configured: false,
        hint: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel → Settings → Environment Variables for this environment (Production/Preview), then redeploy.",
      },
      { status: 503, headers: NO_STORE }
    )
  }
  return NextResponse.json(
    { configured: true, url, anonKey },
    { headers: NO_STORE }
  )
}
