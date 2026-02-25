import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { mapRowToPost } from "@/lib/posts-api"
import type { Post } from "@/lib/mock-data"
import type { PostsFeedRow } from "@/lib/posts-api"

export const dynamic = "force-dynamic"

const FEED_LIMIT = 12

function perfLog(route: string, step: string, ms: number, extra?: Record<string, number | string>) {
  console.log(JSON.stringify({ tag: "perf", route, step, ms, ...extra }))
}

/** Public feed: no auth, cacheable. Uses get_feed(limit_n) RPC — run supabase-get-feed-rpc.sql first. */
export async function GET() {
  const t0 = Date.now()
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    )
  }

  const t1 = Date.now()
  const { data: rows, error } = await supabaseAdmin.rpc("get_feed", { limit_n: FEED_LIMIT })
  const t2 = Date.now()
  perfLog("/api/public-posts", "get_feed_rpc", t2 - t1)

  if (error) {
    console.error("public-posts get_feed", error)
    if (error.code === "42883" || error.message?.includes("function") || error.message?.includes("does not exist")) {
      return NextResponse.json(
        { error: "Run supabase-get-feed-rpc.sql in Supabase SQL Editor to create get_feed(limit_n)." },
        { status: 502 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const feedRows = (Array.isArray(rows) ? rows : []) as PostsFeedRow[]
  const posts: Post[] = feedRows.map((row) => mapRowToPost(row))
  perfLog("/api/public-posts", "total", Date.now() - t0, { posts: posts.length })

  return NextResponse.json(posts, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  })
}
