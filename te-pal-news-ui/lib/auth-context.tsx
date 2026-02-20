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

type ProfileRow = { user_id: string; display_name: string; bio: string | null; avatar_url: string | null }

const DEMO_USER_KEY = "tepal_demo_user"

type AuthContextValue = {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  isDemo: boolean
  signInDemo?: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function profileToUser(profile: ProfileRow): User {
  const name = profile.display_name?.trim() || "?"
  const initials = name.length >= 2 ? name.slice(0, 2).toUpperCase() : name.toUpperCase()
  return {
    id: profile.user_id,
    name: profile.display_name,
    avatar: profile.avatar_url || initials,
    bio: profile.bio ?? undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)

  const fetchProfile = useCallback(async (userId: string): Promise<User | null> => {
    if (!supabase) return null
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, bio, avatar_url")
      .eq("user_id", userId)
      .single()
    if (data) return profileToUser(data as ProfileRow)
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
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(DEMO_USER_KEY)
          if (raw) {
            const parsed = JSON.parse(raw) as User
            if (parsed?.id && parsed?.name) {
              setUser(parsed)
              setIsDemo(true)
            }
          }
        } catch {
          /* ignore */
        }
      }
      setLoading(false)
      return
    }
    setIsDemo(false)
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
    if (typeof window !== "undefined") localStorage.removeItem(DEMO_USER_KEY)
    setUser(null)
    setIsDemo(false)
    router.replace("/auth")
  }, [router])

  const signInDemo = useCallback((demoUser: User) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser))
    }
    setUser(demoUser)
    setIsDemo(true)
    router.replace("/")
  }, [router])

  const value = useMemo(
    () => ({
      user,
      loading,
      signOut,
      isDemo,
      ...(supabase ? {} : { signInDemo }),
    }),
    [user, loading, signOut, isDemo, signInDemo]
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
