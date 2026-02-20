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
const ADMIN_USER_KEY = "tepal_admin_user"

export const ADMIN_USER: User = {
  id: "admin",
  name: "Admin",
  avatar: "A",
  bio: "Admin access",
}

type AuthContextValue = {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  isDemo: boolean
  signInDemo?: (user: User) => void
  signInAsAdmin: () => void
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
          const adminRaw = localStorage.getItem(ADMIN_USER_KEY)
          if (adminRaw) {
            setUser(ADMIN_USER)
            setIsDemo(false)
            setLoading(false)
            return
          }
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
    let cancelled = false
    const init = async () => {
      let done = false
      const finish = () => {
        if (done || cancelled) return
        done = true
        setLoading(false)
      }
      const timeout = setTimeout(finish, 3500)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return
        clearTimeout(timeout)
        if (session?.user) {
          const u = await fetchProfile(session.user.id)
          if (!cancelled) setUser(u ?? null)
        } else {
          if (typeof window !== "undefined") {
            try {
              if (localStorage.getItem(ADMIN_USER_KEY)) {
                if (!cancelled) setUser(ADMIN_USER)
                clearTimeout(timeout)
                finish()
                return
              }
            } catch {
              /* ignore */
            }
          }
          setUser(null)
        }
      } catch {
        if (!cancelled) setUser(null)
      }
      finish()
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
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  // 로그인 안 된 상태면 로그인 화면으로 (loading과 무관하게)
  useEffect(() => {
    const isAuthPage = pathname === "/auth"
    if (!user && !isAuthPage) {
      router.replace("/auth")
    }
  }, [user, pathname, router])
  // 로그인/회원가입 성공 시 앱으로 가는 건 auth 페이지에서 router.replace("/") 로 처리

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    if (typeof window !== "undefined") {
      localStorage.removeItem(DEMO_USER_KEY)
      localStorage.removeItem(ADMIN_USER_KEY)
    }
    setUser(null)
    setIsDemo(false)
    router.replace("/auth")
  }, [router])

  const signInAsAdmin = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(ADMIN_USER_KEY, "1")
    }
    setUser(ADMIN_USER)
    setIsDemo(false)
    router.replace("/")
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
      signInAsAdmin,
      ...(supabase ? {} : { signInDemo }),
    }),
    [user, loading, signOut, isDemo, signInAsAdmin, signInDemo]
  )

  const isAuthPage = pathname === "/auth"
  // 로그인 페이지가 아닐 때만 로딩 시 전체 화면 로딩 (그 외에는 /auth로 보냄)
  if (loading && !user && !isAuthPage) {
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
