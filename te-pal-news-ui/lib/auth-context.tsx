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
import { clearAuthCookie, setAuthCookie } from "@/lib/auth-cookie"

type ProfileRow = { user_id: string; display_name: string; bio: string | null; avatar_url: string | null }

const DEMO_USER_KEY = "tepal_demo_user"
const ADMIN_USER_KEY = "tepal_admin_user"

const DEV_BYPASS_AUTH = typeof process !== "undefined" && process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true"

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
  /** For API calls that require Bearer token (Supabase auth). Returns null for demo/admin. */
  getAccessToken: () => Promise<string | null>
  /** Refetch current user from profiles and update context (e.g. after Edit Profile save). */
  refreshProfile: () => Promise<void>
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
  const [sessionResolved, setSessionResolved] = useState(false)
  const [isDemo, setIsDemo] = useState(false)

  const ensureProfile = useCallback(async (accessToken: string, metadata?: { name?: string; bio?: string } | null) => {
    try {
      const res = await fetch("/api/auth/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: metadata?.name ?? undefined,
          bio: metadata?.bio ?? undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error("[Auth] ensureProfile", data)
      }
    } catch (e) {
      console.error("[Auth] ensureProfile", e)
    }
  }, [])

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
      if (DEV_BYPASS_AUTH && typeof window !== "undefined") {
        try {
          const adminRaw = localStorage.getItem(ADMIN_USER_KEY)
          if (adminRaw) {
            setUser(ADMIN_USER)
            setIsDemo(false)
            setLoading(false)
            setSessionResolved(true)
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
      setSessionResolved(true)
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
        setSessionResolved(true)
      }
      const timeout = setTimeout(finish, 3500)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return
        clearTimeout(timeout)
        if (session?.user) {
          await ensureProfile(session.access_token ?? "", session.user.user_metadata as { name?: string; bio?: string } | undefined)
          const u = await fetchProfile(session.user.id)
          if (!cancelled) setUser(u ?? null)
        } else {
          if (DEV_BYPASS_AUTH && typeof window !== "undefined") {
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
          if (typeof window !== "undefined" && session.access_token) {
            setAuthCookie(session.access_token)
          }
          await ensureProfile(session.access_token ?? "", session.user.user_metadata as { name?: string; bio?: string } | undefined)
          const u = await fetchProfile(session.user.id)
          setUser(u ?? null)
        } else {
          if (typeof window !== "undefined") clearAuthCookie()
          setUser(null)
        }
      }
    )
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [fetchProfile, ensureProfile])

  // 로그인 안 된 상태면 로그인 화면으로. session 판별 완료 후에만 redirect.
  // 홈(/)에서는 절대 redirect 하지 않음 → Chat/다른 링크 클릭이 가드에 막히지 않음. /chat·/me 등은 각 페이지에서 /auth?next=... 처리.
  useEffect(() => {
    if (loading || !sessionResolved) return
    const currentPath =
      typeof window !== "undefined" ? window.location.pathname : pathname
    if (currentPath === "/") return // 홈에서는 redirect 안 함 (첫 클릭으로 Chat 들어가게)
    if (pathname === "/chat" || currentPath === "/chat") return
    if (pathname !== currentPath) return
    const isAuthPage = currentPath === "/auth"
    if (!user && !isAuthPage) {
      const nextPath = currentPath && currentPath !== "/" ? currentPath : ""
      const next = nextPath ? encodeURIComponent(nextPath) : ""
      const target = next ? `/auth?next=${next}` : "/auth"
      console.log("[AUTH_GUARD]", { pathname, currentPath, hasUser: !!user, target })
      router.replace(target)
    }
  }, [user, pathname, router, loading, sessionResolved])
  // 로그인/회원가입 성공 시 앱으로 가는 건 auth 페이지에서 router.replace(safeNext || "/") 로 처리

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    if (typeof window !== "undefined") {
      localStorage.removeItem(DEMO_USER_KEY)
      localStorage.removeItem(ADMIN_USER_KEY)
      clearAuthCookie()
    }
    setUser(null)
    setIsDemo(false)
    router.replace("/auth")
  }, [router])

  const signInAsAdmin = useCallback(() => {
    if (!DEV_BYPASS_AUTH) return
    if (typeof window !== "undefined") {
      localStorage.setItem(ADMIN_USER_KEY, "1")
    }
    setUser(ADMIN_USER)
    setIsDemo(false)
    router.replace("/")
  }, [router])

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!supabase || isDemo) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const u = await fetchProfile(session.user.id)
    if (u) setUser(u)
  }, [fetchProfile, isDemo])

  const signInDemo = useCallback((demoUser: User) => {
    if (!DEV_BYPASS_AUTH) return
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
      getAccessToken,
      refreshProfile,
      ...(supabase ? {} : DEV_BYPASS_AUTH ? { signInDemo } : {}),
    }),
    [user, loading, signOut, isDemo, signInAsAdmin, getAccessToken, refreshProfile, signInDemo]
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
