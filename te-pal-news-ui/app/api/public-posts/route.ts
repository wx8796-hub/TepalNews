import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { mapRowToPost } from "@/lib/posts-api"
import type { Post } from "@/lib/mock-data"
import type { PostsFeedRow } from "@/lib/posts-api"

export const dynamic = "force-dynamic"
/** Edge = fast cold start; avoids ~10s Node serverless wait. */
export const runtime = "edge"

const FEED_LIMIT = 12
const CONTENT_PREVIEW_LEN = 140

function perfLog(route: string, step: string, ms: number, extra?: Record<string, number | string>) {
  console.log(JSON.stringify({ tag: "perf", route, step, ms, ...extra }))
}

/** List payload: truncate content, first media only. No cookies/headers — cacheable. */
function toListPost(p: Post): Post {
  const content = p.content.length > CONTENT_PREVIEW_LEN ? p.content.slice(0, CONTENT_PREVIEW_LEN) : p.content
  const media = p.media?.length ? [p.media[0]] : undefined
  return { ...p, content, media }
}

/** Public feed: no auth, no cookies(), cacheable. Uses get_feed(limit_n) RPC. */
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
  const tRpc = Date.now() - t1
  perfLog("/api/public-posts", "get_feed_rpc", tRpc)

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

  const tMap0 = Date.now()
  const feedRows = (Array.isArray(rows) ? rows : []) as PostsFeedRow[]
  const posts: Post[] = feedRows.map((row) => toListPost(mapRowToPost(row)))
  const tMap = Date.now() - tMap0
  const tTotal = Date.now() - t0
  perfLog("/api/public-posts", "total", tTotal, { posts: posts.length })

  return NextResponse.json(posts, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      "Vary": "Accept-Encoding",
      "Server-Timing": `rpc;dur=${tRpc}, map;dur=${tMap}, total;dur=${tTotal}`,
    },
  })
}
