import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { mapRowToPost } from "@/lib/posts-api"
import type { Post } from "@/lib/mock-data"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }
  const { id } = await params
  let body: Partial<Post>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const updates: Record<string, unknown> = {}
  if (body.type !== undefined) updates.type = body.type
  if (body.title !== undefined) updates.title = body.title ?? null
  if (body.content !== undefined) updates.content = body.content
  if (body.media !== undefined) updates.media = body.media ?? null
  if (body.linkUrl !== undefined) updates.link_url = body.linkUrl ?? null
  if (body.tags !== undefined) updates.tags = body.tags ?? null
  if (body.likes !== undefined) updates.likes = body.likes
  if (body.comments !== undefined) updates.comments = body.comments
  if (body.author !== undefined) updates.author = body.author
  if (Object.keys(updates).length === 0) {
    const { data } = await supabaseAdmin.from("posts").select("*").eq("id", id).single()
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(mapRowToPost(data as Parameters<typeof mapRowToPost>[0]))
  }
  const { data, error } = await supabaseAdmin
    .from("posts")
    .update(updates)
    .eq("id", id)
    .select()
    .single()
  if (error) {
    console.error("posts PATCH", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(mapRowToPost(data as Parameters<typeof mapRowToPost>[0]))
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }
  const { id } = await params
  const { error } = await supabaseAdmin.from("posts").delete().eq("id", id)
  if (error) {
    console.error("posts DELETE", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
