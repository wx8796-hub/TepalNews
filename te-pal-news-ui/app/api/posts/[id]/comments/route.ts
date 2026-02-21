import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { getRequestUserId, getRequestUserIdFromBody } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/** GET comments for post. Returns { comments: Array<{ id, post_id, author_id, body, created_at, author: { id, name, avatar } }> } */
export async function GET(_request: Request, { params }: Params) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }
  const { id: postId } = await params
  const { data: rows, error } = await supabaseAdmin
    .from("comments")
    .select("id, post_id, author_id, body, is_hidden, parent_comment_id, created_at")
    .eq("post_id", postId)
    .eq("is_hidden", false)
    .order("created_at", { ascending: true })
  if (error) {
    console.error("comments GET", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const authorIds = [...new Set((rows ?? []).map((r) => r.author_id))]
  let profiles: { user_id: string; display_name: string | null; avatar_url: string | null }[] = []
  if (authorIds.length > 0) {
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", authorIds)
    profiles = p ?? []
  }
  const profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, p]))
  const comments = (rows ?? []).map((r) => {
    const pr = profileMap[r.author_id]
    const name = pr?.display_name ?? "?"
    const initials = name.slice(0, 2).toUpperCase()
    return {
      id: r.id,
      post_id: r.post_id,
      author_id: r.author_id,
      body: r.body,
      created_at: r.created_at,
      author: {
        id: r.author_id,
        name: pr?.display_name ?? "?",
        avatar: pr?.avatar_url ?? initials,
      },
    }
  })
  return NextResponse.json({ comments })
}

/** POST { body: string, userId?: "admin" }. Create comment. */
export async function POST(request: Request, { params }: Params) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }
  const { id: postId } = await params
  let body: { body?: string; userId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const text = typeof body.body === "string" ? body.body.trim() : ""
  if (!text) {
    return NextResponse.json({ error: "body required" }, { status: 400 })
  }
  const auth = await getRequestUserIdFromBody(request, body)
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { userId } = auth

  const { data: inserted, error } = await supabaseAdmin
    .from("comments")
    .insert({
      post_id: postId,
      author_id: userId,
      body: text,
      is_hidden: false,
      parent_comment_id: null,
    })
    .select("id, post_id, author_id, body, created_at")
    .single()
  if (error) {
    console.error("comments insert", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { data: pr } = await supabaseAdmin
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("user_id", userId)
    .single()
  const name = pr?.display_name ?? "?"
  return NextResponse.json({
    ...inserted,
    author: {
      id: userId,
      name,
      avatar: pr?.avatar_url ?? name.slice(0, 2).toUpperCase(),
    },
  }, { status: 201 })
}
