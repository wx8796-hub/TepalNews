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

export default function AuthPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [bio, setBio] = useState("")
  const [error, setError] = useState("")

  const handleLogin = async () => {
    setError("")
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해 주세요.")
      return
    }
    if (!supabase) {
      setError("로그인 설정이 되어 있지 않습니다.")
      return
    }
    setLoading(true)
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (err) {
        if (err.message.includes("Invalid login")) {
          setError("이메일 또는 비밀번호가 올바르지 않습니다.")
        } else {
          setError(err.message)
        }
        return
      }
      if (data.user) {
        toast.success("로그인되었습니다.")
        router.replace("/")
      }
    } catch {
      setError("오류가 발생했습니다. 다시 시도해 주세요.")
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async () => {
    setError("")
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해 주세요.")
      return
    }
    if (!name.trim()) {
      setError("이름을 입력해 주세요.")
      return
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.")
      return
    }
    if (!supabase) {
      setError("회원가입 설정이 되어 있지 않습니다.")
      return
    }
    setLoading(true)
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { emailRedirectTo: undefined },
      })
      if (err) {
        if (err.message.includes("already registered")) {
          setError("이미 가입된 이메일입니다. 로그인해 주세요.")
        } else {
          setError(err.message)
        }
        return
      }
      if (!data.user) {
        setError("계정 생성에 실패했습니다.")
        return
      }
      const userId = data.user.id
      const { error: profileErr } = await supabase.from("profiles").insert({
        id: userId,
        name: name.trim(),
        bio: bio.trim() || null,
        avatar: null,
      })
      if (profileErr) {
        console.error(profileErr)
        setError("프로필 저장에 실패했습니다. 로그인 후 프로필에서 수정할 수 있습니다.")
      }
      toast.success("회원가입이 완료되었습니다. 로그인해 주세요.")
      router.replace("/")
    } catch {
      setError("오류가 발생했습니다. 다시 시도해 주세요.")
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
              TePal 회원들과 소식, 사진, 영어 팁을 나누는 공간입니다.
            </p>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl bg-primary-foreground/10 p-4">
              <p className="text-sm text-primary-foreground/90 leading-relaxed">
                &quot;TePal News에서 친구들과 영어 연습을 하니 실력이 늘어요!&quot;
              </p>
              <p className="mt-2 text-xs text-primary-foreground/60">- TePal 회원</p>
            </div>
            <p className="text-xs text-primary-foreground/50">
              회원 로그인 후 이용할 수 있습니다.
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
            <p className="text-xs text-muted-foreground">회원 로그인 후 이용할 수 있습니다.</p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="login" className="flex-1">로그인</TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">회원가입</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">이메일 (아이디)</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">비밀번호</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="6자 이상"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button
                className="w-full"
                disabled={loading}
                onClick={handleLogin}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : "로그인"}
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">이메일 (아이디) <span className="text-destructive">*</span></Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">비밀번호 <span className="text-destructive">*</span></Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="6자 이상"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-name">이름 <span className="text-destructive">*</span></Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="홍길동"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-bio">Profile 소개 (선택)</Label>
                <Textarea
                  id="signup-bio"
                  placeholder="자기소개를 입력하세요."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button
                className="w-full"
                disabled={loading}
                onClick={handleSignup}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : "회원가입"}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
