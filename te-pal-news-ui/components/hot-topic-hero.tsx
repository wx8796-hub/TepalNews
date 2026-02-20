"use client"

import Link from "next/link"
import { Flame, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Post } from "@/lib/mock-data"

export function HotTopicHero({ post }: { post: Post }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-primary/5 border border-primary/15 p-6 md:p-8">
      <div className="absolute top-0 right-0 size-40 rounded-full bg-primary/5 -translate-y-1/2 translate-x-1/2" />
      <div className="relative">
        <Badge className="bg-primary/15 text-primary border-0 mb-3">
          <Flame className="size-3" />
          Hot Topic
        </Badge>
        <h2 className="text-xl font-bold text-foreground md:text-2xl text-balance">
          {post.title || post.content.slice(0, 60)}
        </h2>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground leading-relaxed max-w-lg">
          {post.content}
        </p>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{post.author.name}</span>
          <span>{post.createdAt}</span>
          <span>{post.likes} likes</span>
        </div>
        <Button size="sm" className="mt-4" asChild>
          <Link href={`/posts/${post.id}`}>
            View post <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  )
}
