"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, BookOpen, PenSquare, MessageCircle, User } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/english", icon: BookOpen, label: "English" },
  { href: "/posts/new", icon: PenSquare, label: "New" },
  { href: "/chat", icon: MessageCircle, label: "Chat" },
  { href: "/me", icon: User, label: "Profile" },
]

export function BottomNav() {
  const pathname = usePathname()

  if (pathname === "/auth") return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md md:hidden">
      <div className="flex items-center justify-around py-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={item.href === "/chat" ? false : undefined}
              data-e2e={item.href === "/chat" ? "nav-chat-link" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("size-5", isActive && "stroke-[2.5]")} />
              <span className="font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
