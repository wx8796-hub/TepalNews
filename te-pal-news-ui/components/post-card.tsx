"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Heart, MessageCircle, ExternalLink, Image as ImageIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { usePosts } from "@/lib/posts-context"
import type { Post } from "@/lib/mock-data"

export function PostCard({ post }: { post: Post }) {
  const router = useRouter()
  const { user, getAccessToken } = useAuth()
  const { refetch } = usePosts()
  const [likePending, setLikePending] = useState(false)

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) {
      toast.error("Please sign in to like")
      router.push("/auth")
      return
    }
    if (likePending) return
    setLikePending(true)
    const token = await getAccessToken()
    if (!token) {
      toast.error("Please sign in to like")
      setLikePending(false)
      return
    }
    const nextLiked = !post.liked
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ liked: nextLiked }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error("post like failed", res.status, data)
        toast.error((data as { error?: string }).error ?? "Like failed")
        setLikePending(false)
        return
      }
      await refetch(token)
    } catch (err) {
      console.error("post like", err)
      toast.error("Like failed")
    } finally {
      setLikePending(false)
    }
  }

  return (
    <Link href={`/posts/${post.id}`} className="block">
      <article className="rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md">
        <div className="flex items-start gap-3">
          <Avatar className="size-10">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {post.author.avatar}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{post.author.name}</span>
              <span className="text-xs text-muted-foreground">{post.createdAt}</span>
              {post.type === "english-tip" && (
                <Badge variant="secondary" className="text-[10px] bg-accent/10 text-accent border-0">
                  English Tip
                </Badge>
              )}
              {post.type === "photo" && (
                <Badge variant="secondary" className="text-[10px] border-0">
                  <ImageIcon className="size-3" /> Photo
                </Badge>
              )}
            </div>
            {post.title && (
              <h3 className="mt-1 text-sm font-semibold text-foreground">{post.title}</h3>
            )}
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {post.content}
            </p>
            {post.media && post.media.length > 0 && (
              <div className="mt-2 flex h-[240px] w-full max-w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted md:h-[360px] md:max-h-[420px]">
                <img
                  src={post.media[0]}
                  alt=""
                  className="max-h-full max-w-full object-contain object-center"
                />
              </div>
            )}
            {post.tags && post.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {post.tags.map((tag) => (
                  <span key={tag} className="text-xs text-primary/70">
                    {"#"}{tag}
                  </span>
                ))}
              </div>
            )}
            {post.linkUrl && (
              <div className="mt-2">
                <span className="inline-flex items-center gap-1 text-xs text-accent font-medium">
                  <ExternalLink className="size-3" /> Open link
                </span>
              </div>
            )}
            <div className="mt-3 flex items-center gap-4">
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 text-xs transition-colors",
                  post.liked ? "text-primary font-medium" : "text-muted-foreground hover:text-primary"
                )}
                onClick={handleLikeClick}
                disabled={likePending}
                aria-label={post.liked ? "Unlike" : "Like"}
              >
                <Heart className={cn("size-4", post.liked && "fill-primary")} />
                {post.likes}
              </button>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MessageCircle className="size-4" />
                {post.comments}
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}
