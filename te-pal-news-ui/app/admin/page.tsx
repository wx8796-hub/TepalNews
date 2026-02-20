"use client"

import { useState } from "react"
import { Flame, Search, Shield, Eye, EyeOff, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { usePosts, useHotTopic } from "@/lib/posts-context"
import type { Post } from "@/lib/mock-data"

interface Report {
  id: string
  type: "post" | "comment"
  content: string
  author: string
  reason: string
  hidden: boolean
}

const mockReports: Report[] = [
  { id: "r1", type: "post", content: "Spam content here...", author: "Unknown", reason: "Spam", hidden: false },
  { id: "r2", type: "comment", content: "Inappropriate language", author: "Anonymous", reason: "Inappropriate", hidden: false },
]

export default function AdminPage() {
  const { posts, clearPosts, manualHotTopicId, setManualHotTopicId } = usePosts()
  const [searchQuery, setSearchQuery] = useState("")
  const [reports, setReports] = useState(mockReports)
  const hotTopic = useHotTopic()

  const handleClearAllPosts = () => {
    clearPosts()
    toast.success("All posts cleared.")
  }

  const searchResults = searchQuery
    ? posts.filter(
        (p) =>
          p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.title?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  const toggleHide = (id: string) => {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, hidden: !r.hidden } : r))
    )
    toast.success("Report status updated.")
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="size-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Admin</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleClearAllPosts}>
          Clear all posts
        </Button>
      </div>

      {/* Hot Topic Panel */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Flame className="size-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Hot Topic</h2>
        </div>

        {hotTopic ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start justify-between">
              <div>
                <Badge className="bg-primary/15 text-primary border-0 mb-2">
                  Current Hot Topic
                </Badge>
                <h3 className="text-sm font-semibold text-foreground">
                  {hotTopic.title || hotTopic.content.slice(0, 60)}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  By {hotTopic.author.name} - {hotTopic.likes} likes
                </p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">Change</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Are you sure?</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    This will change the current Hot Topic on the home feed.
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <DialogClose asChild>
                      <Button variant="outline" size="sm">Cancel</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button
                        size="sm"
                        onClick={() => {
                          setManualHotTopicId(null)
                          toast.success("Hot Topic cleared.")
                        }}
                      >
                        Clear override
                      </Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No manual Hot Topic set. The system will auto-select based on engagement.
          </p>
        )}

        {/* Search for hot topic */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search posts to set as Hot Topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {searchResults.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {post.title || post.content.slice(0, 50)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {post.author.name} - {post.likes} likes
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setManualHotTopicId(post.id)
                      setSearchQuery("")
                      toast.success("Hot Topic set!")
                    }}
                  >
                    <Flame className="size-3" /> Set
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Moderation Panel */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Moderation</h2>
        </div>

        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reported items. All clear!</p>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="flex items-start gap-3 rounded-xl border border-border p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">
                      {report.type}
                    </Badge>
                    <Badge
                      variant={report.hidden ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      {report.hidden ? "Hidden" : "Visible"}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground">{report.content}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    By {report.author} - Reason: {report.reason}
                  </p>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      {report.hidden ? (
                        <>
                          <Eye className="size-3" /> Unhide
                        </>
                      ) : (
                        <>
                          <EyeOff className="size-3" /> Hide
                        </>
                      )}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {report.hidden ? "Unhide this content?" : "Hide this content?"}
                      </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                      {report.hidden
                        ? "This content will become visible again to all users."
                        : "This content will be hidden from all users."}
                    </p>
                    <div className="flex justify-end gap-2 pt-2">
                      <DialogClose asChild>
                        <Button variant="outline" size="sm">Cancel</Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button
                          size="sm"
                          variant={report.hidden ? "default" : "destructive"}
                          onClick={() => toggleHide(report.id)}
                        >
                          <Check className="size-3" />
                          Confirm
                        </Button>
                      </DialogClose>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
