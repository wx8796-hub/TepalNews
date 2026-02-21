import { NextResponse } from "next/server"
import { getRequestUserId } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase-server"

const GLOBAL_TITLE = "TePal Global Chat"
const GLOBAL_SLUG = "global"

/**
 * GET /api/chat/global — Returns the global conversation id (get-or-create using service role).
 * Requires Authorization: Bearer <access_token>.
 */
export async function GET(request: Request) {
  const auth = await getRequestUserId(request)
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 })
  }

  const bySlugRes = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("slug", GLOBAL_SLUG)
    .maybeSingle()
  if (!bySlugRes.error && bySlugRes.data?.id) {
    return NextResponse.json({ id: bySlugRes.data.id })
  }

  const { data: existing } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("type", "group")
    .eq("title", GLOBAL_TITLE)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    return NextResponse.json({ id: existing.id })
  }

  let inserted: { id: string } | null = null
  let err = await supabaseAdmin
    .from("conversations")
    .insert({ type: "group", title: GLOBAL_TITLE, slug: GLOBAL_SLUG })
    .select("id")
    .single()
    .then((r) => (inserted = r.data, r.error))
  if (err) {
    const r2 = await supabaseAdmin
      .from("conversations")
      .insert({ type: "group", title: GLOBAL_TITLE })
      .select("id")
      .single()
    if (!r2.error && r2.data?.id) return NextResponse.json({ id: r2.data.id })
  } else if (inserted?.id) {
    return NextResponse.json({ id: inserted.id })
  }

  const { data: fallback } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("type", "group")
    .eq("title", GLOBAL_TITLE)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (fallback?.id) {
    return NextResponse.json({ id: fallback.id })
  }

  console.error("[api/chat/global] get-or-create failed", err)
  return NextResponse.json(
    { error: "Could not get or create global conversation" },
    { status: 500 }
  )
}
