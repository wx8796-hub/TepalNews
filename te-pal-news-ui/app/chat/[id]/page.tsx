"use client"

import { useState, useRef, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Send, Users, Info } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { conversations, chatMessages } from "@/lib/mock-data"
import type { ChatMessage } from "@/lib/mock-data"
import { useAuth } from "@/lib/auth-context"

export default function ChatRoomPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const conversation = conversations.find((c) => c.id === params.id)
  const [messages, setMessages] = useState<ChatMessage[]>(chatMessages)
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  if (!conversation) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Conversation not found.</p>
      </div>
    )
  }

  const sendMessage = () => {
    if (!input.trim() || !user) return
    const newMsg: ChatMessage = {
      id: `m${Date.now()}`,
      sender: user,
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isOwn: true,
    }
    setMessages([...messages, newMsg])
    setInput("")
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          onClick={() => router.push("/chat")}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-foreground truncate">{conversation.name}</h2>
          <p className="text-xs text-muted-foreground">
            {conversation.members.length} members
          </p>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex -space-x-2">
            {conversation.members.slice(0, 3).map((m) => (
              <Avatar key={m.id} className="size-6 border-2 border-card">
                <AvatarFallback className="text-[8px] bg-primary/10 text-primary font-semibold">
                  {m.avatar}
                </AvatarFallback>
              </Avatar>
            ))}
            {conversation.members.length > 3 && (
              <div className="flex size-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[8px] font-medium text-muted-foreground">
                +{conversation.members.length - 3}
              </div>
            )}
          </div>
          {conversation.type === "group" && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <Info className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Members</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-2">
                  {conversation.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 py-2">
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {m.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{m.name}</p>
                        {m.bio && (
                          <p className="text-xs text-muted-foreground">{m.bio}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="text-center">
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            Today
          </span>
        </div>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex gap-2", msg.isOwn ? "flex-row-reverse" : "flex-row")}
          >
            {!msg.isOwn && (
              <Avatar className="size-7 mt-1">
                <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                  {msg.sender.avatar}
                </AvatarFallback>
              </Avatar>
            )}
            <div className={cn("max-w-[75%] space-y-0.5", msg.isOwn ? "items-end" : "items-start")}>
              {!msg.isOwn && (
                <p className="text-[10px] text-muted-foreground font-medium ml-1">
                  {msg.sender.name}
                </p>
              )}
              <div
                className={cn(
                  "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  msg.isOwn
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md"
                )}
              >
                {msg.content}
              </div>
              <p
                className={cn(
                  "text-[10px] text-muted-foreground px-1",
                  msg.isOwn ? "text-right" : "text-left"
                )}
              >
                {msg.timestamp}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-card p-3 mb-16 md:mb-0">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="flex-1 h-10 text-sm"
          />
          <Button size="icon" onClick={sendMessage} disabled={!input.trim()}>
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
