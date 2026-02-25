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

type PostRow = {
  id: string
  author_id: string
  type: string
  title: string | null
  content: string
  link_url: string | null
  tags: string[] | null
  is_hidden: boolean
  created_at: string
  updated_at?: string
}
type ProfileRow = { user_id: string; display_name: string | null; avatar_url: string | null; bio: string | null }

function buildFeedRows(
  postRows: PostRow[],
  profileByAuthor: Record<string, ProfileRow>,
  likeCountByPost: Record<string, number>,
  commentCountByPost: Record<string, number>,
  mediaByPost: Record<string, string[]>
): PostsFeedRow[] {
  return postRows.map((p) => {
    const pr = profileByAuthor[p.author_id]
    const type = (p.type === "english_tip" ? "english-tip" : p.type) as "photo" | "update" | "english-tip"
    return {
      id: p.id,
      author_id: p.author_id,
      type,
      title: p.title,
      content: p.content,
      link_url: p.link_url,
      tags: p.tags,
      is_hidden: p.is_hidden,
      created_at: p.created_at,
      updated_at: p.updated_at,
      display_name: pr?.display_name ?? null,
      avatar_url: pr?.avatar_url ?? null,
      bio: pr?.bio ?? null,
      like_count: likeCountByPost[p.id] ?? 0,
      comment_count: commentCountByPost[p.id] ?? 0,
      media: mediaByPost[p.id]?.length ? mediaByPost[p.id] : null,
    }
  })
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

  const tPosts0 = Date.now()
  const { data: postRows, error: postsErr } = await supabaseAdmin
    .from("posts")
    .select("id, author_id, type, title, content, link_url, tags, is_hidden, created_at, updated_at")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT)
  const tPosts1 = Date.now()
  perfLog("/api/posts", "posts_query", tPosts1 - tPosts0)

  if (postsErr) {
    console.error("posts GET", postsErr)
    return NextResponse.json({ error: postsErr.message }, { status: 500 })
  }
  const postsList = (postRows ?? []) as PostRow[]
  if (postsList.length === 0) {
    perfLog("/api/posts", "total", Date.now() - t0, { posts: 0 })
    return NextResponse.json([], {
      headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" },
    })
  }

  const authorIds = [...new Set(postsList.map((p) => p.author_id))]
  const postIds = postsList.map((p) => p.id)

  const tAgg0 = Date.now()
  const [profilesRes, likesRes, commentsRes, mediaRes] = await Promise.all([
    supabaseAdmin.from("profiles").select("user_id, display_name, avatar_url, bio").in("user_id", authorIds),
    supabaseAdmin.from("post_likes").select("post_id").in("post_id", postIds),
    supabaseAdmin.from("comments").select("post_id").eq("is_hidden", false).in("post_id", postIds),
    supabaseAdmin.from("post_media").select("post_id, storage_path, sort_order").in("post_id", postIds).order("sort_order"),
  ])
  const tAgg1 = Date.now()
  perfLog("/api/posts", "profiles_likes_comments_media", tAgg1 - tAgg0)

  const profileByAuthor: Record<string, ProfileRow> = {}
  ;(profilesRes.data ?? []).forEach((r) => {
    profileByAuthor[(r as ProfileRow).user_id] = r as ProfileRow
  })
  const likeCountByPost: Record<string, number> = {}
  ;(likesRes.data ?? []).forEach((r: { post_id: string }) => {
    likeCountByPost[r.post_id] = (likeCountByPost[r.post_id] ?? 0) + 1
  })
  const commentCountByPost: Record<string, number> = {}
  ;(commentsRes.data ?? []).forEach((r: { post_id: string }) => {
    commentCountByPost[r.post_id] = (commentCountByPost[r.post_id] ?? 0) + 1
  })
  const mediaByPost: Record<string, string[]> = {}
  ;(mediaRes.data ?? []).forEach((r: { post_id: string; storage_path: string }) => {
    if (!mediaByPost[r.post_id]) mediaByPost[r.post_id] = []
    mediaByPost[r.post_id].push(r.storage_path)
  })

  const rows = buildFeedRows(postsList, profileByAuthor, likeCountByPost, commentCountByPost, mediaByPost)
  const t2 = Date.now()
  perfLog("/api/posts", "mapping", t2 - tAgg1, { rows: rows.length })

  const posts: Post[] = rows.map((row) => mapRowToPost(row))

  const authResult = await authPromise
  if ("userId" in authResult && authResult.userId && posts.length > 0) {
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
