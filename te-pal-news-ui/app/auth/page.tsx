"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase-browser"
import { useAuth } from "@/lib/auth-context"

const DEMO_USER = {
  id: "demo-user",
  name: "Demo User",
  avatar: "DU",
  bio: "Try the app without setting up Supabase.",
}

export default function AuthPage() {
  const router = useRouter()
  const { signInDemo } = useAuth()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [bio, setBio] = useState("")
  const [error, setError] = useState("")

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
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (err) {
        const msg = err.message.toLowerCase()
        if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
          setError("Invalid email or password.")
        } else if (msg.includes("email not confirmed")) {
          setError("Please confirm your email first. Check your inbox for the confirmation link.")
        } else {
          setError(err.message)
        }
        return
      }
      if (data.session) {
        toast.success("Signed in!")
        router.refresh()
        router.replace("/")
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
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
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { name: name.trim(), bio: bio.trim() || null },
        },
      })
      if (err) {
        if (err.message.includes("already registered") || err.message.includes("already been registered")) {
          setError("This email is already registered. Please sign in.")
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
        }
      } else {
        const { error: profileErr } = await supabase.from("profiles").insert({
          id: data.user.id,
          name: name.trim(),
          bio: bio.trim() || null,
          avatar: null,
        })
        if (profileErr) console.error(profileErr)
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

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="login" className="flex-1">Log in</TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">Sign up</TabsTrigger>
            </TabsList>

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
              </form>
              {!supabase && signInDemo && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase text-muted-foreground">
                    <span className="bg-card px-2">Or</span>
                  </div>
                </div>
              )}
              {!supabase && signInDemo && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    signInDemo(DEMO_USER)
                    toast.success("Signed in as demo user.")
                  }}
                >
                  Continue as demo user
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
