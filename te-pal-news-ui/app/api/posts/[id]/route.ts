import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { getRequestUser, isAdminUserId } from "@/lib/api-auth"
import { mapRowToPost, appTypeToDb } from "@/lib/posts-api"
import type { Post } from "@/lib/mock-data"
import type { PostsFeedRow } from "@/lib/posts-api"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

const FEED_SELECT =
  "id, author_id, type, title, content, link_url, tags, is_hidden, created_at, updated_at, display_name, avatar_url, bio, like_count, comment_count, media"

/** GET single post; optional Authorization for liked flag */
export async function GET(request: Request, { params }: Params) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }
  const { id } = await params
  const { data: feedRow, error } = await supabaseAdmin
    .from("posts_feed")
    .select(FEED_SELECT)
    .eq("id", id)
    .single()
  if (error || !feedRow) {
    console.error("posts GET [id]", error)
    return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 })
  }
  const post = mapRowToPost(feedRow as PostsFeedRow)
  let userId: string | null = null
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim()
  if (token && supabaseAdmin) {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (user) userId = user.id
  }
  if (!userId && request.headers.get("x-user-id") === "admin" && process.env.SUPABASE_ADMIN_UID) {
    userId = process.env.SUPABASE_ADMIN_UID
  }
  let liked = false
  if (userId) {
    const { data: likeRow } = await supabaseAdmin
      .from("post_likes")
      .select("post_id")
      .eq("post_id", id)
      .eq("user_id", userId)
      .maybeSingle()
    liked = !!likeRow
  }
  return NextResponse.json({ ...post, liked })
}

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
  if (body.type !== undefined) updates.type = appTypeToDb(body.type)
  if (body.title !== undefined) updates.title = body.title ?? null
  if (body.content !== undefined) updates.content = body.content
  if (body.linkUrl !== undefined) updates.link_url = body.linkUrl ?? null
  if (body.tags !== undefined) updates.tags = body.tags ?? []
  if (body.media !== undefined) {
    const mediaPaths = Array.isArray(body.media) ? body.media : []
    await supabaseAdmin.from("post_media").delete().eq("post_id", id)
    if (mediaPaths.length > 0) {
      const mediaRows = mediaPaths.map((storage_path, i) => ({
        post_id: id,
        storage_path,
        sort_order: i,
      }))
      await supabaseAdmin.from("post_media").insert(mediaRows)
    }
  }
  if (Object.keys(updates).length > 0) {
    const { error } = await supabaseAdmin.from("posts").update(updates).eq("id", id)
    if (error) {
      console.error("posts PATCH", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
  const { data: feedRow, error: fetchErr } = await supabaseAdmin
    .from("posts_feed")
    .select(FEED_SELECT)
    .eq("id", id)
    .single()
  if (fetchErr || !feedRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(mapRowToPost(feedRow as PostsFeedRow))
}

export async function DELETE(request: Request, { params }: Params) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }
  const { id } = await params
  const auth = await getRequestUser(request)
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { data: postRow } = await supabaseAdmin
    .from("posts")
    .select("author_id")
    .eq("id", id)
    .single()
  if (!postRow) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 })
  }
  const authorId = postRow.author_id as string
  const canDelete =
    auth.userId === authorId || isAdminUserId(auth.userId, auth.email)
  if (!canDelete) {
    return NextResponse.json(
      { error: "Only the author or an admin can delete this post" },
      { status: 403 }
    )
  }
  await supabaseAdmin.from("post_media").delete().eq("post_id", id)
  const { error } = await supabaseAdmin.from("posts").delete().eq("id", id)
  if (error) {
    console.error("posts DELETE", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
