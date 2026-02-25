import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { getRequestUser } from "@/lib/api-auth"
import { mapRowToPost, postToInsertRow } from "@/lib/posts-api"
import type { Post } from "@/lib/mock-data"
import type { PostsFeedRow } from "@/lib/posts-api"

export const dynamic = "force-dynamic"

const FEED_SELECT_VIEW =
  "id, author_id, type, title, content, link_url, tags, is_hidden, created_at, updated_at, display_name, avatar_url, bio, like_count, comment_count, media"
const FEED_LIMIT = 12

function perfLog(route: string, step: string, ms: number, extra?: Record<string, number | string>) {
  console.log(JSON.stringify({ tag: "perf", route, step, ms, ...extra }))
}

export async function GET(request: Request) {
  const t0 = Date.now()
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local." },
      { status: 503 }
    )
  }

  const authPromise = getRequestUser(request).catch(() => ({ error: "none", status: 0 } as const))

  const t1 = Date.now()
  const { data: rows, error: rpcErr } = await supabaseAdmin.rpc("get_feed", { limit_n: FEED_LIMIT })
  const t2 = Date.now()
  perfLog("/api/posts", "get_feed_rpc", t2 - t1)

  if (rpcErr) {
    console.error("posts GET get_feed", rpcErr)
    if (rpcErr.code === "42883" || rpcErr.message?.includes("function") || rpcErr.message?.includes("does not exist")) {
      return NextResponse.json(
        { error: "Run supabase-get-feed-rpc.sql in Supabase SQL Editor to create get_feed(limit_n)." },
        { status: 502 }
      )
    }
    return NextResponse.json({ error: rpcErr.message }, { status: 500 })
  }

  const feedRows = (Array.isArray(rows) ? rows : []) as PostsFeedRow[]
  const posts: Post[] = feedRows.map((row) => mapRowToPost(row))

  const authResult = await authPromise
  if ("userId" in authResult && authResult.userId && posts.length > 0) {
    const postIds = posts.map((p) => p.id)
    const tLikes0 = Date.now()
    const { data: userLikeRows } = await supabaseAdmin
      .from("post_likes")
      .select("post_id")
      .eq("user_id", authResult.userId)
      .in("post_id", postIds)
    perfLog("/api/posts", "auth_likes", Date.now() - tLikes0)
    const likedSet = new Set((userLikeRows ?? []).map((r: { post_id: string }) => r.post_id))
    posts.forEach((p) => {
      p.liked = likedSet.has(p.id)
    })
  }

  perfLog("/api/posts", "total", Date.now() - t0, { posts: posts.length })
  return NextResponse.json(posts, {
    headers: {
      "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
    },
  })
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
  let authorId = body.author?.id
  if (!authorId) {
    return NextResponse.json({ error: "author.id required" }, { status: 400 })
  }
  if (authorId === "admin") {
    const adminUid = process.env.SUPABASE_ADMIN_UID
    if (!adminUid) {
      return NextResponse.json(
        { error: "Admin posting: set SUPABASE_ADMIN_UID to a valid Supabase auth user UUID in env." },
        { status: 400 }
      )
    }
    authorId = adminUid
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
    if (mediaErr) {
      console.error("post_media insert", mediaErr)
      return NextResponse.json({ error: `Post created but media failed: ${mediaErr.message}` }, { status: 500 })
    }
  }
  const { data: feedRow, error: fetchErr } = await supabaseAdmin
    .from("posts_feed")
    .select(FEED_SELECT_VIEW)
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
