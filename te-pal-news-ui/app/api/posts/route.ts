import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { mapRowToPost, postToInsertRow } from "@/lib/posts-api"
import type { Post } from "@/lib/mock-data"
import type { PostsFeedRow } from "@/lib/posts-api"

export const dynamic = "force-dynamic"

const FEED_SELECT =
  "id, author_id, type, title, content, link_url, tags, is_hidden, created_at, updated_at, display_name, avatar_url, bio, like_count, comment_count, media"

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json([])
  }
  const { data, error } = await supabaseAdmin
    .from("posts_feed")
    .select(FEED_SELECT)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
  if (error) {
    console.error("posts GET", error)
    const msg = error.message || ""
    if (msg.includes("posts.media") || msg.includes("does not exist")) {
      return NextResponse.json(
        {
          error:
            "Schema mismatch: use Supabase Schema v1. In SQL Editor run supabase-schema-v1.sql (creates posts_feed view). Then redeploy this app.",
        },
        { status: 502 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const posts = (data ?? []).map((row) => mapRowToPost(row as PostsFeedRow))
  return NextResponse.json(posts)
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      {
        error:
          "Database not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local (or Vercel env).",
      },
      { status: 503 }
    )
  }
  let body: Post & { author: { id: string } }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const authorId = body.author?.id
  if (!authorId) {
    return NextResponse.json({ error: "author.id required" }, { status: 400 })
  }
  const insertRow = postToInsertRow(body, authorId)
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("posts")
    .insert(insertRow)
    .select("id")
    .single()
  if (insertError) {
    console.error("posts POST", insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }
  const postId = inserted.id as string
  const mediaPaths = Array.isArray(body.media) ? body.media : []
  if (mediaPaths.length > 0) {
    const mediaRows = mediaPaths.map((storage_path, i) => ({
      post_id: postId,
      storage_path,
      sort_order: i,
    }))
    const { error: mediaErr } = await supabaseAdmin.from("post_media").insert(mediaRows)
    if (mediaErr) console.error("post_media insert", mediaErr)
  }
  const { data: feedRow, error: fetchErr } = await supabaseAdmin
    .from("posts_feed")
    .select(FEED_SELECT)
    .eq("id", postId)
    .single()
  if (fetchErr || !feedRow) {
    const fallbackRow: PostsFeedRow = {
      ...inserted,
      ...insertRow,
      type: body.type,
      author_id: authorId,
      like_count: 0,
      comment_count: 0,
      is_hidden: false,
      display_name: body.author?.name ?? null,
      avatar_url: body.author?.avatar ?? null,
      bio: body.author?.bio ?? null,
      created_at: new Date().toISOString(),
      media: mediaPaths.length ? mediaPaths : null,
    }
    return NextResponse.json(mapRowToPost(fallbackRow), { status: 201 })
  }
  return NextResponse.json(mapRowToPost(feedRow as PostsFeedRow), { status: 201 })
}
