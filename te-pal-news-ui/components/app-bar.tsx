"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PenSquare, MessageCircle, User, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"

export function AppBar() {
  const pathname = usePathname()
  const { canAccessAdmin } = useAuth()

  if (pathname === "/auth") return null

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">T</span>
          </div>
          <span className="text-lg font-bold text-foreground">TePal News</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <Button variant={pathname === "/posts/new" ? "secondary" : "ghost"} size="sm" asChild>
            <Link href="/posts/new">
              <PenSquare className="size-4" />
              <span>New Post</span>
            </Link>
          </Button>
          <Button
            variant={pathname.startsWith("/chat") ? "secondary" : "ghost"}
            size="sm"
            asChild
          >
            <Link href="/chat" prefetch={false} data-e2e="nav-chat-link">
              <MessageCircle className="size-4" />
              <span>Chat</span>
            </Link>
          </Button>
          <Button variant={pathname === "/me" ? "secondary" : "ghost"} size="sm" asChild>
            <Link href="/me">
              <User className="size-4" />
              <span>Profile</span>
            </Link>
          </Button>
          {canAccessAdmin && (
            <Button variant={pathname === "/admin" ? "secondary" : "ghost"} size="sm" asChild>
              <Link href="/admin">
                <Shield className="size-4" />
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}
