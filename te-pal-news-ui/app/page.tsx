"use client"

import { useState, useMemo, useEffect } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { HotTopicHero } from "@/components/hot-topic-hero"
import { WeeklyBestTop3 } from "@/components/weekly-best-top3"
import { PostCard } from "@/components/post-card"
import { useAuth } from "@/lib/auth-context"
import { usePosts, useWeeklyBest, useHotTopic } from "@/lib/posts-context"
import type { Post } from "@/lib/mock-data"

const filterTabs = ["All", "Photos", "Updates", "English Tips"] as const
type FilterTab = (typeof filterTabs)[number]
const PAGE_SIZE = 10
const TRENDING_SCORE = (p: Post) => p.likes * 2 + p.comments * 3

export default function HomePage() {
  const { user, getAccessToken } = useAuth()
  const { posts, loading, error, refetch } = usePosts()
  const weeklyBest = useWeeklyBest()
  const hotTopic = useHotTopic()
  const [activeTab, setActiveTab] = useState<FilterTab>("All")
  const [sort, setSort] = useState("latest")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const filteredPosts = useMemo(() => {
    let list = posts.filter((post) => {
      if (activeTab === "Photos") return post.type === "photo"
      if (activeTab === "Updates") return post.type === "update"
      if (activeTab === "English Tips") return post.type === "english-tip"
      return true
    })
    list = list.filter((post) => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        post.content.toLowerCase().includes(q) ||
        post.title?.toLowerCase().includes(q) ||
        post.author.name.toLowerCase().includes(q) ||
        (post.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
    })
    if (sort === "trending") {
      list = [...list].sort((a, b) => TRENDING_SCORE(b) - TRENDING_SCORE(a))
    } else {
      list = [...list]
    }
    return list
  }, [posts, activeTab, search, sort])

  const visiblePosts = filteredPosts.slice(0, page * PAGE_SIZE)
  const hasMore = visiblePosts.length < filteredPosts.length

  useEffect(() => {
    ;(async () => {
      const token = user ? await getAccessToken() : null
      refetch(token ?? undefined)
    })()
  }, [user?.id, getAccessToken, refetch])

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      {loading && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading posts">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-full bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-muted" />
                  <div className="h-3 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-[200px] w-full rounded-lg bg-muted md:h-[280px]" />
                  <div className="h-3 w-1/4 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-sm text-destructive">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}
      {!loading && !error && hotTopic && <HotTopicHero post={hotTopic} />}

      {!loading && !error && <WeeklyBestTop3 posts={weeklyBest} />}

      {!loading && !error && (
      <>
      <div className="sticky top-14 z-40 -mx-4 bg-background/80 backdrop-blur-md px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)} className="flex-1">
            <TabsList className="w-full">
              {filterTabs.map((tab) => (
                <TabsTrigger key={tab} value={tab} className="flex-1 text-xs">
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[110px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest</SelectItem>
              <SelectItem value="trending">Trending 7d</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search posts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredPosts.length > 0 ? (
          <>
            {visiblePosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            {hasMore && (
              <div className="py-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No posts found. Be the first to share something!</p>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  )
}
