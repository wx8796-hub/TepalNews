"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { toast } from "sonner"

export default function AuthPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (mode: "login" | "signup") => {
    setError("")
    if (!email || !password) {
      setError("Please fill in all fields.")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1200))
    setLoading(false)
    toast.success(mode === "login" ? "Welcome back!" : "Account created!")
    router.push("/")
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
              Your warm community space for sharing updates, photos, and English learning tips with fellow TePal members.
            </p>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl bg-primary-foreground/10 p-4">
              <p className="text-sm text-primary-foreground/90 leading-relaxed">
                {"\"TePal News has been amazing for practicing my English with friends!\""}
              </p>
              <p className="mt-2 text-xs text-primary-foreground/60">- Sarah, TePal member</p>
            </div>
            <p className="text-xs text-primary-foreground/50">
              TePal members - anyone with the link can join.
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
            <p className="text-xs text-muted-foreground">TePal members - anyone with the link can join.</p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="login" className="flex-1">Log in</TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button
                className="w-full"
                disabled={loading}
                onClick={() => handleSubmit("login")}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Log in"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Email verification is not required.
              </p>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button
                className="w-full"
                disabled={loading}
                onClick={() => handleSubmit("signup")}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Email verification is not required.
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
