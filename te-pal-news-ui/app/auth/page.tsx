"use client"

import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase-browser"
import { useAuth } from "@/lib/auth-context"
import { withTimeout } from "@/lib/promise-utils"
import { setAuthCookie } from "@/lib/auth-cookie"

const DEMO_USER = {
  id: "demo-user",
  name: "Demo User",
  avatar: "DU",
  bio: "Try the app without setting up Supabase.",
}

const DEV_BYPASS_AUTH =
  typeof process !== "undefined" &&
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true"

function AuthPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get("next") ?? ""
  const safeNext = nextUrl.startsWith("/") && !nextUrl.startsWith("//") ? nextUrl : ""
  const { user, signInDemo, signInAsAdmin } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [bio, setBio] = useState("")
  const [error, setError] = useState("")
  const [alreadyRegisteredEmail, setAlreadyRegisteredEmail] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const [authTab, setAuthTab] = useState<"login" | "signup">("login")

  useEffect(() => {
    setMounted(true)
  }, [])

  // 세이프가드: 이미 로그인된 상태면 next 또는 "/"로 이동 (next는 URL에서 직접 읽어서 리다이렉트 직후에도 올바르게 복귀)
  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (!session?.user) return
      const nextFromUrl =
        typeof window !== "undefined"
          ? (() => {
              const q = new URLSearchParams(window.location.search)
              const n = q.get("next") ?? ""
              return n.startsWith("/") && !n.startsWith("//") ? n : ""
            })()
          : ""
      const destination = nextFromUrl || safeNext || "/"
      router.replace(destination)
    })
    return () => {
      cancelled = true
    }
  }, [router, safeNext])

  const supabaseHost = typeof window !== "undefined" && process.env.NEXT_PUBLIC_SUPABASE_URL
    ? (() => {
        try {
          return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
        } catch {
          return "invalid-url"
        }
      })()
    : null

const handleLogin = async () => {
    setError("")
    if (!email.trim() || !password) {
      setError("Please enter your email and password.")
      return
    }
    if (!supabase) {
      setError("Sign-in is not available. Add Supabase env vars to .env.local, or use Demo login below.")
      return
    }
    setLoading(true)
    try {
      const result = await withTimeout(
        supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        }),
        8000,
        "signIn"
      )
      const { data, error: err } = result
      if (err) {
        console.error("signInWithPassword", { message: err.message, status: (err as { status?: number }).status })
        const msg = (err.message || "").toLowerCase()
        const userMsg =
          msg.includes("invalid login") || msg.includes("invalid credentials")
            ? "Invalid email or password."
            : msg.includes("email not confirmed") || msg.includes("confirm your email")
              ? "Please confirm your email first. Check your inbox for the confirmation link."
              : err.message
        setError(userMsg)
        toast.error(userMsg)
        return
      }
      if (!data.session) {
        const userMsg = "Please confirm your email before signing in. Check your inbox for the confirmation link."
        setError(userMsg)
        toast.error(userMsg)
        return
      }
      toast.success("Signed in!")
      setAuthCookie(data.session.access_token)
      const destination = safeNext || "/"
      router.replace(destination)
      router.refresh()
      setTimeout(() => {
        if (typeof window !== "undefined" && window.location.pathname === "/auth") {
          window.location.assign(destination)
        }
      }, 500)
      ensureProfile(data.session.access_token, data.user?.user_metadata).catch((e) => {
        console.error("ensureProfile after login", e)
      })
    } catch (e) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : e instanceof Error
            ? e.message
            : "Something went wrong. Please try again."
      if (msg.includes("timeout")) {
        console.warn("[login] Sign-in timed out (handled). Check network and Supabase URL in .env.local.")
        toast.error("Login timed out. Check network, CORS, and Supabase env.")
      } else {
        console.error("handleLogin", e)
        toast.error(msg)
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function ensureProfile(accessToken: string, metadata?: { name?: string; bio?: string } | null) {
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
        console.error("ensureProfile", data)
      }
    } catch (e) {
      console.error("ensureProfile", e)
    }
  }

  const handleSignup = async () => {
    setError("")
    if (!email.trim() || !password) {
      setError("Please enter your email and password.")
      return
    }
    if (!name.trim()) {
      setError("Please enter your name.")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }
    if (!supabase) {
      setError("Sign-up is not available. Add Supabase env vars to .env.local, or use Demo login below.")
      return
    }
    setLoading(true)
    setAlreadyRegisteredEmail(null)
    setResetSent(false)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    try {
      if (supabaseUrl) {
        try {
          console.info("[signUp] supabase host:", new URL(supabaseUrl).host)
        } catch {
          console.warn("[signUp] SUPABASE_URL invalid")
        }
      } else {
        console.warn("[signUp] NEXT_PUBLIC_SUPABASE_URL is undefined")
      }
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { name: name.trim(), bio: bio.trim() || null },
        },
      })
      if (err) {
        console.error("signUp error", {
          status: (err as { status?: number }).status,
          message: err.message,
          name: (err as { name?: string }).name,
        })
        const isAlreadyRegistered =
          err.message.includes("already registered") ||
          err.message.includes("already been registered") ||
          (err.message || "").toLowerCase().includes("already registered")
        if (isAlreadyRegistered) {
          setError("This email is already registered. Please sign in or reset your password.")
          setAlreadyRegisteredEmail(email.trim().toLowerCase())
        } else {
          setError(err.message)
        }
        return
      }
      if (!data.user) {
        setError("Account creation failed.")
        return
      }
      const accessToken = data.session?.access_token
      if (accessToken) {
        const profileRes = await fetch("/api/auth/profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ name: name.trim(), bio: bio.trim() || null }),
        })
        if (!profileRes.ok) {
          const msg = await profileRes.json().catch(() => ({}))
          console.error("Profile API", msg)
          setError((msg as { error?: string }).error ?? "Failed to create profile. Check console.")
          setLoading(false)
          return
        }
      } else {
        const { data: _, error: profileErr } = await supabase.from("profiles").insert({
          user_id: data.user.id,
          display_name: name.trim(),
          bio: bio.trim() || null,
          avatar_url: null,
        }).select().single()
        if (profileErr) {
          console.error("profiles insert", profileErr)
          setError(profileErr.message)
          setLoading(false)
          return
        }
      }
      if (data.session) {
        toast.success("Account created!")
        router.refresh()
        router.replace("/")
      } else {
        toast.success("Account created! Please check your email to confirm, then sign in.")
        router.replace("/auth")
      }
    } catch (e) {
      console.error(e)
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (user && supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-lg text-center max-w-sm">
          <p className="text-sm text-muted-foreground mb-4">You&apos;re already signed in as {user.name}.</p>
          <Button onClick={() => router.replace(safeNext || "/")}>Go to app</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="flex w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-lg md:min-h-[520px]">
        {/* Brand panel - hidden on mobile */}
        <div className="hidden w-[360px] flex-col justify-between bg-primary p-8 md:flex">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/20">
                <span className="text-lg font-bold text-primary-foreground">T</span>
              </div>
              <span className="text-xl font-bold text-primary-foreground">TePal News</span>
            </div>
            <p className="mt-6 text-sm text-primary-foreground/80 leading-relaxed">
              Your space to share updates, photos, and English tips with TePal members.
            </p>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl bg-primary-foreground/10 p-4">
              <p className="text-sm text-primary-foreground/90 leading-relaxed">
                &quot;TePal News has been great for practicing English with friends!&quot;
              </p>
              <p className="mt-2 text-xs text-primary-foreground/60">— TePal member</p>
            </div>
            <p className="text-xs text-primary-foreground/50">
              Sign in to use TePal News.
            </p>
          </div>
        </div>

        {/* Auth panel */}
        <div className="flex flex-1 flex-col justify-center p-6 md:p-10">
          <div className="md:hidden mb-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-sm font-bold text-primary-foreground">T</span>
              </div>
              <span className="text-lg font-bold text-foreground">TePal News</span>
            </div>
            <p className="text-xs text-muted-foreground">Sign in to use TePal News.</p>
          </div>

          {safeNext === "/chat" && (
            <p className="mb-3 text-sm text-muted-foreground">Sign in to continue to Chat. You’ll be taken there after logging in.</p>
          )}
          <Tabs value={authTab} onValueChange={(v) => { setAuthTab(v as "login" | "signup"); setError(""); setAlreadyRegisteredEmail(null); setResetSent(false); }} className="w-full">
            <TabsList className="w-full mb-2">
              <TabsTrigger value="login" className="flex-1">Log in</TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">Sign up</TabsTrigger>
            </TabsList>
            <p className="text-xs text-muted-foreground mb-4">
              {!mounted ? "Sign in to use TePal News." : supabase ? "Supabase: connected" : "Supabase: not configured — use Demo login below."}
              {mounted && supabaseHost && (
                <span className="block mt-1 text-[10px] text-muted-foreground/80" title="Verify this is your project">
                  Host: {supabaseHost}
                </span>
              )}
            </p>

            <TabsContent value="login" className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleLogin()
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Log in"}
                </Button>
                {DEV_BYPASS_AUTH && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => signInAsAdmin()}
                  >
                    Admin 권한으로 접속 (DEV)
                  </Button>
                )}
              </form>
              {DEV_BYPASS_AUTH && mounted && !supabase && signInDemo && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase text-muted-foreground">
                    <span className="bg-card px-2">Or</span>
                  </div>
                </div>
              )}
              {DEV_BYPASS_AUTH && mounted && !supabase && signInDemo && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    signInDemo(DEMO_USER)
                    toast.success("Signed in as demo user.")
                  }}
                >
                  Continue as demo user (DEV)
                </Button>
              )}
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email <span className="text-destructive">*</span></Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password <span className="text-destructive">*</span></Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-name">Name <span className="text-destructive">*</span></Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-bio">Profile (optional)</Label>
                <Textarea
                  id="signup-bio"
                  placeholder="A short bio about you"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              {alreadyRegisteredEmail && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">This email is already registered.</p>
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setAuthTab("login")
                        setAlreadyRegisteredEmail(null)
                        setError("")
                      }}
                    >
                      Log in instead
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={resetSent || !supabase}
                      onClick={async () => {
                        if (!supabase || !alreadyRegisteredEmail) return
                        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(alreadyRegisteredEmail, {
                          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined,
                        })
                        if (resetErr) {
                          console.error("resetPasswordForEmail", resetErr)
                          toast.error(resetErr.message)
                          return
                        }
                        setResetSent(true)
                        toast.success("Check your email for the password reset link.")
                      }}
                    >
                      {resetSent ? "Reset email sent" : "Send password reset email"}
                    </Button>
                  </div>
                </div>
              )}
              <Button
                type="button"
                className="w-full"
                disabled={loading}
                onClick={handleSignup}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign up"}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <AuthPageContent />
    </Suspense>
  )
}
