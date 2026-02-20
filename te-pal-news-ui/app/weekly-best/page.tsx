"use client"

import Link from "next/link"
import { ArrowLeft, Trophy, Heart, MessageCircle } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useWeeklyBest } from "@/lib/posts-context"

const rankStyles = [
  { bg: "bg-amber-500", text: "text-white", border: "border-amber-200" },
  { bg: "bg-zinc-400", text: "text-white", border: "border-zinc-200" },
  { bg: "bg-amber-700", text: "text-white", border: "border-amber-300" },
]

export default function WeeklyBestPage() {
  const weeklyBest = useWeeklyBest()
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/"
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Trophy className="size-6 text-amber-500" />
          <h1 className="text-2xl font-bold text-foreground">Weekly Best</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Top 3 posts from the last 7 days
        </p>
      </div>

      <div className="space-y-4">
        {weeklyBest.length === 0 ? (
          <div className="py-16 text-center">
            <Trophy className="mx-auto size-12 text-muted-foreground/30" />
            <p className="mt-4 text-sm text-muted-foreground">
              No weekly best available yet. Keep posting!
            </p>
          </div>
        ) : (
          weeklyBest.map((post, i) => (
            <Link key={post.id} href={`/posts/${post.id}`} className="block">
              <div
                className={cn(
                  "rounded-xl border bg-card p-5 transition-all hover:shadow-md",
                  i === 0 ? "border-amber-200 bg-amber-50/30" : "border-border"
                )}
              >
                <div className="flex items-start gap-4">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold",
                      rankStyles[i].bg,
                      rankStyles[i].text
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-foreground">
                      {post.title || post.content.slice(0, 60)}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground leading-relaxed">
                      {post.content}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-5">
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                            {post.author.avatar}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">{post.author.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{post.createdAt}</span>
                      <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Heart className="size-3" /> {post.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="size-3" /> {post.comments}
                        </span>
                      </div>
                    </div>
                    {post.tags && post.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {post.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">
                            {"#"}{tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Last updated: Today at 12:00 AM
      </p>
    </div>
  )
}
