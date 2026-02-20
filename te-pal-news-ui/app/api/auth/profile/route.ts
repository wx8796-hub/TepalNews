import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server auth not configured" },
      { status: 503 }
    )
  }
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim()
  if (!token) {
    return NextResponse.json({ error: "Missing authorization" }, { status: 401 })
  }
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
  }
  let body: { name?: string; displayName?: string; bio?: string | null; avatar_url?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const name = typeof body.name === "string" ? body.name.trim() : (typeof body.displayName === "string" ? body.displayName.trim() : null)
  const bio = body.bio !== undefined ? (typeof body.bio === "string" ? body.bio.trim() || null : null) : undefined
  const avatarUrl = body.avatar_url !== undefined ? (typeof body.avatar_url === "string" ? body.avatar_url.trim() || null : null) : undefined
  const displayName = name || (user.user_metadata?.name as string) || "User"
  const row: { user_id: string; display_name: string; bio: string | null; avatar_url: string | null } = {
    user_id: user.id,
    display_name: displayName,
    bio: bio !== undefined ? bio : null,
    avatar_url: avatarUrl !== undefined ? avatarUrl : null,
  }
  const { error: upsertError } = await supabaseAdmin
    .from("profiles")
    .upsert(row, { onConflict: "user_id" })
  if (upsertError) {
    console.error("profile upsert", upsertError)
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
