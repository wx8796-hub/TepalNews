"use client"

import Link from "next/link"
import { Heart, MessageCircle, ExternalLink, Image as ImageIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Post } from "@/lib/mock-data"

export function PostCard({ post }: { post: Post }) {
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
              <div className="mt-2 rounded-lg overflow-hidden border border-border bg-muted aspect-video max-h-40 w-full">
                <img
                  src={post.media[0]}
                  alt=""
                  className="w-full h-full object-cover"
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
                className={cn(
                  "flex items-center gap-1.5 text-xs transition-colors",
                  post.liked ? "text-primary font-medium" : "text-muted-foreground hover:text-primary"
                )}
                onClick={(e) => e.preventDefault()}
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
