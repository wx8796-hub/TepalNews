"use client"

import { useState } from "react"
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
import { HotTopicHero } from "@/components/hot-topic-hero"
import { WeeklyBestTop3 } from "@/components/weekly-best-top3"
import { PostCard } from "@/components/post-card"
import { posts, weeklyBest } from "@/lib/mock-data"

const filterTabs = ["All", "Photos", "Updates", "English Tips"] as const
type FilterTab = (typeof filterTabs)[number]

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("All")
  const [sort, setSort] = useState("latest")
  const [search, setSearch] = useState("")

  const hotTopic = posts.find((p) => p.isHotTopic)

  const filteredPosts = posts.filter((post) => {
    if (activeTab === "Photos") return post.type === "photo"
    if (activeTab === "Updates") return post.type === "update"
    if (activeTab === "English Tips") return post.type === "english-tip"
    return true
  }).filter((post) => {
    if (!search) return true
    return (
      post.content.toLowerCase().includes(search.toLowerCase()) ||
      post.title?.toLowerCase().includes(search.toLowerCase()) ||
      post.author.name.toLowerCase().includes(search.toLowerCase())
    )
  })

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      {hotTopic && <HotTopicHero post={hotTopic} />}

      <WeeklyBestTop3 posts={weeklyBest} />

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
          filteredPosts.map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No posts found. Be the first to share something!</p>
          </div>
        )}
      </div>
    </div>
  )
}
