"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import type { User } from "@/lib/mock-data"
import { supabase } from "@/lib/supabase-browser"

type ProfileRow = { id: string; name: string; bio: string | null; avatar: string | null }

type AuthContextValue = {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function profileToUser(profile: ProfileRow, email: string): User {
  const initials =
    profile.name.trim().length >= 2
      ? profile.name.trim().slice(0, 2).toUpperCase()
      : profile.name.trim().toUpperCase() || "?"
  return {
    id: profile.id,
    name: profile.name,
    avatar: profile.avatar || initials,
    bio: profile.bio ?? undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string): Promise<User | null> => {
    if (!supabase) return null
    const { data } = await supabase
      .from("profiles")
      .select("id, name, bio, avatar")
      .eq("id", userId)
      .single()
    if (data) return profileToUser(data as ProfileRow, "")
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return null
    const fallback: User = {
      id: authUser.id,
      name: (authUser.user_metadata?.name as string) || authUser.email?.split("@")[0] || "User",
      avatar: "?",
      bio: (authUser.user_metadata?.bio as string) || undefined,
    }
    return fallback
  }, [])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const u = await fetchProfile(session.user.id)
        setUser(u ?? null)
      } else {
        setUser(null)
      }
      setLoading(false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const u = await fetchProfile(session.user.id)
          setUser(u ?? null)
        } else {
          setUser(null)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [fetchProfile])

  useEffect(() => {
    if (loading) return
    const isAuthPage = pathname === "/auth"
    if (!user && !isAuthPage) {
      router.replace("/auth")
    }
  }, [loading, user, pathname, router])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
    router.replace("/auth")
  }, [router])

  const value = useMemo(
    () => ({ user, loading, signOut }),
    [user, loading, signOut]
  )

  const isAuthPage = pathname === "/auth"
  if (loading && !isAuthPage) {
    return (
      <AuthContext.Provider value={value}>
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </AuthContext.Provider>
    )
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
