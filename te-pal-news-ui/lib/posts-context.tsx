"use client"

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react"
import type { Post } from "@/lib/mock-data"

const TRENDING_SCORE = (p: Post) => p.likes * 2 + p.comments * 3

type PostsContextValue = {
  posts: Post[]
  addPost: (post: Post) => void
  updatePost: (id: string, updates: Partial<Post>) => void
  deletePost: (id: string) => void
  clearPosts: () => void
  manualHotTopicId: string | null
  setManualHotTopicId: (id: string | null) => void
}

const PostsContext = createContext<PostsContextValue | null>(null)

export function PostsProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [manualHotTopicId, setManualHotTopicId] = useState<string | null>(null)

  const addPost = useCallback((post: Post) => {
    setPosts((prev) => [post, ...prev])
  }, [])

  const updatePost = useCallback((id: string, updates: Partial<Post>) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    )
  }, [])

  const deletePost = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id))
    setManualHotTopicId((mid) => (mid === id ? null : mid))
  }, [])

  const clearPosts = useCallback(() => {
    setPosts([])
    setManualHotTopicId(null)
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
    }),
    [posts, addPost, updatePost, deletePost, clearPosts, manualHotTopicId]
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
