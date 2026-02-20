"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Share2,
  ExternalLink,
  MoreHorizontal,
  Send,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { posts, comments as mockComments, currentUser } from "@/lib/mock-data"

export default function PostDetailPage() {
  const params = useParams()
  const router = useRouter()
  const post = posts.find((p) => p.id === params.id)
  const [liked, setLiked] = useState(post?.liked ?? false)
  const [likeCount, setLikeCount] = useState(post?.likes ?? 0)
  const [newComment, setNewComment] = useState("")
  const [comments, setComments] = useState(mockComments)

  if (!post) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Post not found.</p>
      </div>
    )
  }

  const toggleLike = () => {
    setLiked(!liked)
    setLikeCount(liked ? likeCount - 1 : likeCount + 1)
  }

  const sendComment = () => {
    if (!newComment.trim()) return
    setComments([
      ...comments,
      {
        id: `c${Date.now()}`,
        author: currentUser,
        content: newComment,
        createdAt: "Just now",
        likes: 0,
      },
    ])
    setNewComment("")
    toast.success("Comment added!")
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" /> Back
      </button>

      <article className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* Media carousel placeholder */}
        {post.media && post.media.length > 0 && (
          <div className="aspect-video bg-muted flex items-center justify-center border-b border-border">
            <span className="text-sm text-muted-foreground">Photo</span>
          </div>
        )}

        <div className="p-6 space-y-4">
          {/* Author header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {post.author.avatar}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{post.author.name}</span>
                  {post.type === "english-tip" && (
                    <Badge variant="secondary" className="text-[10px] bg-accent/10 text-accent border-0">
                      English Tip
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{post.createdAt}</span>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => toast("Edit coming soon")}>Edit</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => toast("Delete coming soon")}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Title + Content */}
          {post.title && (
            <h1 className="text-xl font-bold text-foreground">{post.title}</h1>
          )}
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{post.content}</p>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {"#"}{tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Link button */}
          {post.linkUrl && (
            <a
              href={post.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent hover:bg-accent/20 transition-colors"
            >
              <ExternalLink className="size-4" /> Open link
            </a>
          )}

          {/* Action row */}
          <div className="flex items-center gap-4 border-t border-border pt-4">
            <button
              onClick={toggleLike}
              className={cn(
                "flex items-center gap-1.5 text-sm transition-colors",
                liked ? "text-primary font-medium" : "text-muted-foreground hover:text-primary"
              )}
            >
              <Heart className={cn("size-5", liked && "fill-primary")} />
              {likeCount}
            </button>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MessageCircle className="size-5" />
              {comments.length}
            </span>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href)
                toast.success("Link copied!")
              }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Share2 className="size-5" />
              Share
            </button>
          </div>
        </div>

        {/* Comments */}
        <div className="border-t border-border">
          <div className="p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">
              Comments ({comments.length})
            </h2>
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No comments yet. Be the first to share your thoughts!
              </p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                        {comment.author.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {comment.author.name}
                        </span>
                        <span className="text-xs text-muted-foreground">{comment.createdAt}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-foreground leading-relaxed">
                        {comment.content}
                      </p>
                      <button className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                        <Heart className="size-3" /> {comment.likes}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comment composer */}
          <div className="sticky bottom-16 md:bottom-0 border-t border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Avatar className="size-8">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                  {currentUser.avatar}
                </AvatarFallback>
              </Avatar>
              <Input
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendComment()}
                className="flex-1 h-9 text-sm"
              />
              <Button
                size="icon-sm"
                onClick={sendComment}
                disabled={!newComment.trim()}
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}
