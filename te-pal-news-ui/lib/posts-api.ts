import { formatDistanceToNow } from "date-fns"
import type { Post, User } from "@/lib/mock-data"

/** Row shape from public.posts_feed view (schema v1) */
export type PostsFeedRow = {
  id: string
  author_id: string
  type: "photo" | "update" | "english-tip"
  title: string | null
  content: string
  link_url: string | null
  tags: string[] | null
  is_hidden: boolean
  created_at: string
  updated_at?: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  like_count: number
  comment_count: number
  media: string[] | null // json agg of storage_path
}

export function mapRowToPost(row: PostsFeedRow): Post {
  const createdAt =
    row.created_at && !Number.isNaN(Date.parse(row.created_at))
      ? formatDistanceToNow(new Date(row.created_at), { addSuffix: true })
      : "Just now"
  const name = row.display_name?.trim() || "?"
  const initials = name.length >= 2 ? name.slice(0, 2).toUpperCase() : name.toUpperCase()
  const author: User = {
    id: row.author_id,
    name: row.display_name ?? "?",
    avatar: row.avatar_url || initials,
    bio: row.bio ?? undefined,
  }
  const media = Array.isArray(row.media) ? row.media : (typeof row.media === "string" ? [row.media] : [])
  return {
    id: row.id,
    type: row.type,
    author,
    title: row.title ?? undefined,
    content: row.content,
    media: media.length ? media : undefined,
    linkUrl: row.link_url ?? undefined,
    tags: Array.isArray(row.tags) ? row.tags : undefined,
    likes: Number(row.like_count) ?? 0,
    comments: Number(row.comment_count) ?? 0,
    liked: false,
    createdAt,
  }
}

/** App type uses 'english-tip'; DB enum is 'english_tip' */
export function appTypeToDb(type: Post["type"]): "photo" | "update" | "english_tip" {
  if (type === "english-tip") return "english_tip"
  return type
}

export function dbTypeToApp(type: string): Post["type"] {
  if (type === "english_tip") return "english-tip"
  return type as Post["type"]
}

/** For INSERT into posts table (schema v1) */
export function postToInsertRow(post: Post, authorId: string) {
  return {
    author_id: authorId,
    type: appTypeToDb(post.type),
    title: post.title ?? null,
    content: post.content,
    link_url: post.linkUrl ?? null,
    tags: post.tags ?? [],
  }
}
