"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, Plus, Users, MessageCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { conversations } from "@/lib/mock-data"

export default function ChatListPage() {
  const [search, setSearch] = useState("")

  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Chats</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/chat/new?type=dm">
              <Plus className="size-4" /> New DM
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/chat/new?type=group">
              <Users className="size-4" /> New Group
            </Link>
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      <div className="space-y-1">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <MessageCircle className="mx-auto size-12 text-muted-foreground/30" />
            <p className="mt-4 text-sm font-medium text-foreground">No chats yet</p>
            <p className="text-sm text-muted-foreground">
              Start a chat with TePal members.
            </p>
          </div>
        ) : (
          filtered.map((chat) => (
            <Link key={chat.id} href={`/chat/${chat.id}`} className="block">
              <div className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted">
                <div className="relative">
                  {chat.type === "group" ? (
                    <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
                      <Users className="size-5 text-primary" />
                    </div>
                  ) : (
                    <Avatar className="size-11">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {chat.members[1]?.avatar || "?"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{chat.name}</span>
                    <span className="text-xs text-muted-foreground">{chat.lastMessageTime}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground mt-0.5">
                    {chat.lastMessage}
                  </p>
                </div>
                {chat.unread > 0 && (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {chat.unread}
                  </span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
