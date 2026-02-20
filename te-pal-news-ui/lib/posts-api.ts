import { formatDistanceToNow } from "date-fns"
import type { Post, User } from "@/lib/mock-data"

export type PostRow = {
  id: string
  type: "photo" | "update" | "english-tip"
  author: User
  title: string | null
  content: string
  media: string[] | null
  link_url: string | null
  tags: string[] | null
  likes: number
  comments: number
  created_at: string
}

export function mapRowToPost(row: PostRow): Post {
  const createdAt =
    row.created_at && !Number.isNaN(Date.parse(row.created_at))
      ? formatDistanceToNow(new Date(row.created_at), { addSuffix: true })
      : "Just now"
  return {
    id: row.id,
    type: row.type,
    author: row.author as User,
    title: row.title ?? undefined,
    content: row.content,
    media: row.media ?? undefined,
    linkUrl: row.link_url ?? undefined,
    tags: row.tags ?? undefined,
    likes: row.likes ?? 0,
    comments: row.comments ?? 0,
    liked: false,
    createdAt,
  }
}

export function postToRow(post: Post): Omit<PostRow, "created_at"> & { created_at?: string } {
  return {
    id: post.id,
    type: post.type,
    author: post.author,
    title: post.title ?? null,
    content: post.content,
    media: post.media ?? null,
    link_url: post.linkUrl ?? null,
    tags: post.tags ?? null,
    likes: post.likes ?? 0,
    comments: post.comments ?? 0,
    created_at: new Date().toISOString(),
  }
}
