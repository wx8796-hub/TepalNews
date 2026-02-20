"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react"
import type { Post } from "@/lib/mock-data"

const HOT_TOPIC_KEY = "tepals-manual-hot-topic"
const TRENDING_SCORE = (p: Post) => p.likes * 2 + p.comments * 3

type PostsContextValue = {
  posts: Post[]
  addPost: (post: Post) => Promise<Post>
  updatePost: (id: string, updates: Partial<Post>) => Promise<void>
  deletePost: (id: string) => Promise<void>
  clearPosts: () => void
  manualHotTopicId: string | null
  setManualHotTopicId: (id: string | null) => void
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const PostsContext = createContext<PostsContextValue | null>(null)

function loadManualHotTopic(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(HOT_TOPIC_KEY)
  } catch {
    return null
  }
}

function saveManualHotTopic(id: string | null) {
  if (typeof window === "undefined") return
  try {
    if (id) localStorage.setItem(HOT_TOPIC_KEY, id)
    else localStorage.removeItem(HOT_TOPIC_KEY)
  } catch {
    /* ignore */
  }
}

export function PostsProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [manualHotTopicId, setManualHotTopicId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/posts")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to load posts (${res.status})`)
      }
      const data = await res.json()
      setPosts(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load posts")
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setManualHotTopicId(loadManualHotTopic())
    refetch()
  }, [refetch])

  useEffect(() => {
    saveManualHotTopic(manualHotTopicId)
  }, [manualHotTopicId])

  const addPost = useCallback(async (post: Post): Promise<Post> => {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || "Failed to save post")
    }
    const saved = (await res.json()) as Post
    setPosts((prev) => [saved, ...prev])
    return saved
  }, [])

  const updatePost = useCallback(async (id: string, updates: Partial<Post>) => {
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update post")
      }
      const updated = await res.json()
      setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)))
    } catch (e) {
      throw e
    }
  }, [])

  const deletePost = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete post")
      }
      setPosts((prev) => prev.filter((p) => p.id !== id))
      setManualHotTopicId((mid) => (mid === id ? null : mid))
    } catch (e) {
      throw e
    }
  }, [])

  const clearPosts = useCallback(() => {
    setPosts([])
    setManualHotTopicId(null)
    saveManualHotTopic(null)
  }, [])

  const value = useMemo(
    () => ({
      posts,
      addPost,
      updatePost,
      deletePost,
      clearPosts,
      manualHotTopicId,
      setManualHotTopicId,
      loading,
      error,
      refetch,
    }),
    [
      posts,
      addPost,
      updatePost,
      deletePost,
      clearPosts,
      manualHotTopicId,
      loading,
      error,
      refetch,
    ]
  )

  return (
    <PostsContext.Provider value={value}>
      {children}
    </PostsContext.Provider>
  )
}

export function usePosts() {
  const ctx = useContext(PostsContext)
  if (!ctx) throw new Error("usePosts must be used within PostsProvider")
  return ctx
}

/** Hot Topic: manual override if set, else auto (trending score 1st). */
export function useHotTopic(): Post | null {
  const { posts, manualHotTopicId } = usePosts()
  if (posts.length === 0) return null
  if (manualHotTopicId) {
    const manual = posts.find((p) => p.id === manualHotTopicId)
    if (manual) return manual
  }
  const sorted = [...posts].sort((a, b) => TRENDING_SCORE(b) - TRENDING_SCORE(a))
  return sorted[0] ?? null
}

/** Top 3 posts by trending score (for Weekly Best). */
export function useWeeklyBest(): Post[] {
  const { posts } = usePosts()
  return [...posts]
    .sort((a, b) => TRENDING_SCORE(b) - TRENDING_SCORE(a))
    .slice(0, 3)
}
