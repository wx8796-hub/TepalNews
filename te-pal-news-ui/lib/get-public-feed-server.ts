import { unstable_cache } from "next/cache"
import { supabaseAdmin } from "@/lib/supabase-server"
import { mapRowToPost } from "@/lib/posts-api"
import type { Post } from "@/lib/mock-data"
import type { PostsFeedRow } from "@/lib/posts-api"

const FEED_LIMIT = 12
const CONTENT_PREVIEW_LEN = 140

function toListPost(p: Post): Post {
  const content = p.content.length > CONTENT_PREVIEW_LEN ? p.content.slice(0, CONTENT_PREVIEW_LEN) : p.content
  const media = p.media?.length ? [p.media[0]] : undefined
  return { ...p, content, media }
}

/** Server-only. No cookies/headers. Returns public feed for SSR. */
async function getPublicFeedUncached(): Promise<Post[]> {
  if (!supabaseAdmin) return []
  const { data: rows, error } = await supabaseAdmin.rpc("get_feed", { limit_n: FEED_LIMIT })
  if (error || !Array.isArray(rows)) return []
  const feedRows = rows as PostsFeedRow[]
  return feedRows.map((row) => toListPost(mapRowToPost(row)))
}

/** Cached public feed for home page SSR. revalidate 300s. */
export const getPublicFeedServer = unstable_cache(
  getPublicFeedUncached,
  ["public-feed"],
  { revalidate: 300 }
)
