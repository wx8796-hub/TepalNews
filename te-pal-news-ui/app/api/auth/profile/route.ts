import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

/** Payload: DB column names only. */
type ProfilePayload = {
  display_name: string
  bio: string | null
  avatar_url: string | null
  updated_at: string
}

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
    console.error("[profile] auth failed", userError)
    return NextResponse.json(
      { error: userError?.message ?? "Invalid or expired token" },
      { status: 401 }
    )
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

  // Resolve existing row (try id first — Table Editor often shows id as first column)
  let existing: { display_name: string | null; bio: string | null; avatar_url: string | null } | null = null
  const { data: byId } = await supabaseAdmin
    .from("profiles")
    .select("display_name, bio, avatar_url")
    .eq("id", user.id)
    .maybeSingle()
  existing = byId
  if (!existing) {
    const { data: byUserId } = await supabaseAdmin
      .from("profiles")
      .select("display_name, bio, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
    existing = byUserId
  }

  const displayName = (name ?? existing?.display_name ?? (user.user_metadata?.name as string) ?? "User").trim() || "User"
  const now = new Date().toISOString()
  const payload: ProfilePayload = {
    display_name: displayName,
    bio: bio !== undefined ? bio : (existing?.bio ?? null),
    avatar_url: avatarUrl !== undefined ? avatarUrl : (existing?.avatar_url ?? null),
    updated_at: now,
  }

  console.log("[profile] updating for user", user.id, "payload.display_name:", payload.display_name)

  // 1) Update by id (recommended: profiles.id = auth.users.id)
  let { data: updated, error: updateError } = await supabaseAdmin
    .from("profiles")
    .update(payload)
    .eq("id", user.id)
    .select("id, display_name, bio, avatar_url, updated_at")
    .maybeSingle()

  if (updateError) {
    const msg = updateError.message ?? ""
    if (msg.includes("id") || msg.includes("column") || msg.includes("does not exist")) {
      console.log("[profile] update by id failed, trying user_id:", msg)
      const res = await supabaseAdmin
        .from("profiles")
        .update(payload)
        .eq("user_id", user.id)
        .select("user_id, display_name, bio, avatar_url, updated_at")
        .maybeSingle()
      if (res.error) {
        console.error("[profile] update by user_id failed", res.error)
        return NextResponse.json({ error: res.error.message }, { status: 500 })
      }
      updated = res.data
    } else {
      console.error("[profile] update by id failed", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
  }

  if (!updated) {
    // 2) No row matched id — try user_id
    const { data: byUser, error: errUser } = await supabaseAdmin
      .from("profiles")
      .update(payload)
      .eq("user_id", user.id)
      .select()
      .maybeSingle()
    if (!errUser && byUser) {
      console.log("[profile] updated by user_id")
      return NextResponse.json({ ok: true, updated: byUser })
    }
    if (errUser) console.error("[profile] update by user_id (0 rows fallback) failed", errUser)
    // 3) Upsert so row is created/updated (id or user_id)
    const upsertRow = { id: user.id, ...payload }
    const { data: upserted, error: upsertErr } = await supabaseAdmin
      .from("profiles")
      .upsert(upsertRow, { onConflict: "id" })
      .select()
      .single()
    if (upsertErr) {
      const { data: u2, error: u2Err } = await supabaseAdmin
        .from("profiles")
        .upsert({ user_id: user.id, ...payload }, { onConflict: "user_id" })
        .select()
        .single()
      if (u2Err) {
        console.error("[profile] upsert failed (id and user_id)", upsertErr, u2Err)
        return NextResponse.json({ error: u2Err.message }, { status: 500 })
      }
      console.log("[profile] upsert by user_id ok")
      return NextResponse.json({ ok: true, updated: u2 })
    }
    console.log("[profile] upsert by id ok")
    return NextResponse.json({ ok: true, updated: upserted })
  }

  console.log("[profile] update by id ok, rows:", updated?.display_name)
  return NextResponse.json({ ok: true, updated })
}
