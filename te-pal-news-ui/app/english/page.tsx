"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, Heart, ExternalLink, BookOpen } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePosts } from "@/lib/posts-context"

export default function EnglishTipsPage() {
  const { posts } = usePosts()
  const tips = posts.filter((p) => p.type === "english-tip")
  const allTags = Array.from(new Set(tips.flatMap((t) => t.tags || [])))
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState("latest")
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const filtered = tips
    .filter((tip) => {
      if (search) {
        const q = search.toLowerCase()
        return (
          tip.content.toLowerCase().includes(q) ||
          tip.title?.toLowerCase().includes(q) ||
          tip.author.name.toLowerCase().includes(q) ||
          (tip.tags ?? []).some((t) => t.toLowerCase().includes(q))
        )
      }
      return true
    })
    .filter((tip) => {
      if (selectedTags.length === 0) return true
      return selectedTags.some((tag) => tip.tags?.includes(tag))
    })
    .sort((a, b) => {
      if (sort === "most-liked") return b.likes - a.likes
      return 0
    })

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <BookOpen className="size-6 text-accent" />
          <h1 className="text-2xl font-bold text-foreground">English Tips</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Learn and share English tips with TePal members
        </p>
      </div>

      {/* Search & Sort */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tips..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Latest</SelectItem>
            <SelectItem value="most-liked">Most liked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedTags.includes(tag)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {"#"}{tag}
            </button>
          ))}
        </div>
      )}

      {/* Tips list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen className="mx-auto size-12 text-muted-foreground/30" />
            <p className="mt-4 text-sm font-medium text-foreground">No tips found</p>
            <p className="text-sm text-muted-foreground">
              Share your first tip with TePal!
            </p>
          </div>
        ) : (
          filtered.map((tip) => (
            <Link key={tip.id} href={`/posts/${tip.id}`} className="block">
              <div className="rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md">
                {tip.title && (
                  <h3 className="text-sm font-semibold text-foreground mb-1">
                    {tip.title}
                  </h3>
                )}
                <p className="line-clamp-3 text-sm text-muted-foreground leading-relaxed">
                  {tip.content}
                </p>
                {tip.tags && tip.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tip.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">
                        {"#"}{tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-3">
                  {tip.linkUrl && (
                    <span className="flex items-center gap-1 text-xs text-accent font-medium">
                      <ExternalLink className="size-3" /> Open link
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <Heart className="size-3" /> {tip.likes}
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
