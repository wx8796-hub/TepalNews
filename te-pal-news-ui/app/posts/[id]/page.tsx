"use client"

import { useState, useEffect, useCallback } from "react"
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
import Link from "next/link"
import { usePosts } from "@/lib/posts-context"
import { useAuth } from "@/lib/auth-context"
import type { Comment, Post } from "@/lib/mock-data"
import { Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export default function PostDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, getAccessToken } = useAuth()
  const { posts, deletePost, refetch } = usePosts()
  const postId = typeof params.id === "string" ? params.id : ""
  const [post, setPost] = useState<Post | null>(posts.find((p) => p.id === postId) ?? null)
  const [postLoading, setPostLoading] = useState(!!postId)
  const [liked, setLiked] = useState(post?.liked ?? false)
  const [likeCount, setLikeCount] = useState(post?.likes ?? 0)
  const [newComment, setNewComment] = useState("")
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set())

  const isOwnPost = user && post?.author.id === user.id

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (user?.id === "admin") return { "X-User-Id": "admin" }
    const token = await getAccessToken()
    if (token) return { Authorization: `Bearer ${token}` }
    return {}
  }, [user?.id, getAccessToken])

  const authBody = useCallback(() => {
    if (user?.id === "admin") return { userId: "admin" as const }
    return {}
  }, [user?.id])

  useEffect(() => {
    if (!postId) {
      setPostLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const headers = await authHeaders()
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}`, { headers })
      if (cancelled) return
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error((data as { error?: string }).error ?? "Failed to load post")
        setPost(null)
        setPostLoading(false)
        return
      }
      const data = (await res.json()) as Post & { liked?: boolean }
      setPost({ ...data, liked: data.liked ?? false })
      setLiked(data.liked ?? false)
      setLikeCount(data.likes ?? 0)
      setPostLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [postId, authHeaders])

  useEffect(() => {
    if (!postId) return
    setCommentsLoading(true)
    fetch(`/api/posts/${encodeURIComponent(postId)}/comments`)
      .then((res) => res.json())
      .then((data) => {
        const list = (data as { comments?: Array<{ id: string; author: { id: string; name: string; avatar: string }; body: string; created_at: string }> }).comments ?? []
        setComments(
          list.map((c) => ({
            id: c.id,
            author: c.author,
            content: c.body,
            createdAt: c.created_at && !Number.isNaN(Date.parse(c.created_at))
              ? formatDistanceToNow(new Date(c.created_at), { addSuffix: true })
              : "Just now",
            likes: 0,
          }))
        )
      })
      .catch((e) => {
        console.error("comments fetch", e)
        toast.error("Failed to load comments")
      })
      .finally(() => setCommentsLoading(false))
  }, [postId])

  const toggleLike = async () => {
    if (!user) {
      toast.error("Sign in to like")
      return
    }
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikeCount((c) => (nextLiked ? c + 1 : c - 1))
    const headers: HeadersInit = { "Content-Type": "application/json", ...(await authHeaders()) }
    const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/like`, {
      method: "POST",
      headers,
      body: JSON.stringify({ liked: nextLiked, ...authBody() }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setLiked(!nextLiked)
      setLikeCount((c) => (nextLiked ? c - 1 : c + 1))
      toast.error((data as { error?: string }).error ?? "Like failed")
      console.error("like", data)
    }
  }

  const sendComment = async () => {
    if (!newComment.trim()) return
    if (!user) {
      toast.error("Sign in to comment")
      return
    }
    const body = newComment.trim()
    setNewComment("")
    const headers: HeadersInit = { "Content-Type": "application/json", ...(await authHeaders()) }
    const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body, ...authBody() }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error((data as { error?: string }).error ?? "Failed to post comment")
      console.error("comment", data)
      setNewComment(body)
      return
    }
    const c = data as { id: string; author: { id: string; name: string; avatar: string }; body: string; created_at: string }
    setComments((prev) => [
      ...prev,
      {
        id: c.id,
        author: c.author,
        content: c.body,
        createdAt: "Just now",
        likes: 0,
      },
    ])
    toast.success("Comment added!")
  }

  const deleteComment = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId))
    toast.success("Comment removed.")
  }

  const handleDeletePost = async () => {
    if (!post) return
    try {
      await deletePost(post.id)
      router.push("/")
      toast.success("Post deleted.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete post")
      console.error(e)
    }
  }

  if (postLoading && !post) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }
  if (!post) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Post not found.</p>
      </div>
    )
  }

  const toggleCommentLike = (commentId: string) => {
    const isCurrentlyLiked = likedCommentIds.has(commentId)
    setLikedCommentIds((prev) => {
      const next = new Set(prev)
      if (next.has(commentId)) next.delete(commentId)
      else next.add(commentId)
      return next
    })
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, likes: isCurrentlyLiked ? c.likes - 1 : c.likes + 1 }
          : c
      )
    )
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
        {/* Uploaded images */}
        {post.media && post.media.length > 0 && (
          <div className="border-b border-border space-y-0">
            {post.media.map((src, i) => (
              <div key={i} className="w-full aspect-video max-h-[70vh] bg-muted">
                <img
                  src={src}
                  alt={`${post.title || "Post"} image ${i + 1}`}
                  className="w-full h-full object-contain"
                />
              </div>
            ))}
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
            {isOwnPost && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/posts/${post.id}/edit`}>Edit</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={handleDeletePost}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
                        {user && comment.author.id === user.id && (
                          <button
                            type="button"
                            onClick={() => deleteComment(comment.id)}
                            className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                            aria-label="Delete comment"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-foreground leading-relaxed">
                        {comment.content}
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleCommentLike(comment.id)}
                        className={cn(
                          "mt-1 flex items-center gap-1 text-xs transition-colors",
                          likedCommentIds.has(comment.id)
                            ? "text-primary font-medium"
                            : "text-muted-foreground hover:text-primary"
                        )}
                      >
                        <Heart
                          className={cn("size-3", likedCommentIds.has(comment.id) && "fill-primary")}
                        />
                        {comment.likes}
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
                  {user?.avatar}
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
