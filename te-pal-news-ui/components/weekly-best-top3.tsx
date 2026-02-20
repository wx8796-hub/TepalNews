"use client"

import Link from "next/link"
import { Trophy, Heart, MessageCircle } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { Post } from "@/lib/mock-data"

const rankColors = [
  "bg-amber-500 text-white",
  "bg-zinc-400 text-white",
  "bg-amber-700 text-white",
]

export function WeeklyBestTop3({ posts }: { posts: Post[] }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="size-5 text-amber-500" />
        <h2 className="text-base font-bold text-foreground">Weekly Best</h2>
        <Link href="/weekly-best" className="ml-auto text-xs text-primary font-medium hover:underline">
          View all
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {posts.map((post, i) => (
          <Link
            key={post.id}
            href={`/posts/${post.id}`}
            className="flex min-w-[220px] flex-1 flex-col rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md"
          >
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  rankColors[i]
                )}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-foreground">
                  {post.title || post.content.slice(0, 40)}
                </h3>
                <div className="mt-1 flex items-center gap-2">
                  <Avatar className="size-5">
                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                      {post.author.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">{post.author.name}</span>
                </div>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
              {post.content}
            </p>
            <div className="mt-auto pt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Heart className="size-3" /> {post.likes}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="size-3" /> {post.comments}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
