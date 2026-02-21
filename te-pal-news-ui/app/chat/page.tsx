"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Send, Users } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { getSupabase } from "@/lib/supabase-browser"
import { useAuth } from "@/lib/auth-context"
import { getGlobalConversationId, getOrCreateGlobalConversation, GLOBAL_CHAT_TITLE } from "@/lib/chat-global"

type MessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

type ProfileRow = {
  user_id: string
  display_name: string | null
  avatar_url: string | null
}

type MessageWithProfile = MessageRow & {
  display_name: string
  avatar_url: string | null
}

const PRESENCE_CHANNEL = "presence:global-chat"

// Session cache: show last-loaded chat immediately when navigating back to /chat
let cachedGlobalId: string | null = null
let cachedMessages: MessageWithProfile[] = []

export default function GlobalChatPage() {
  const router = useRouter()
  const { user: appUser } = useAuth()
  const [globalId, setGlobalId] = useState<string | null>(cachedGlobalId)
  const [messages, setMessages] = useState<MessageWithProfile[]>(cachedMessages)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(cachedGlobalId ? false : true)
  const [error, setError] = useState<string | null>(null)
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([])
  const [profilesCache, setProfilesCache] = useState<Record<string, ProfileRow>>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const redirectSent = useRef(false)
  const authUserId = useRef<string | null>(null)
  const chatLoadedRef = useRef(false)

  useEffect(() => {
    const path = typeof window !== "undefined" ? window.location.pathname : ""
    console.log("[CHAT_PAGE] mounted", path)
  }, [])

  const ensureProfile = useCallback(async (userId: string): Promise<ProfileRow | null> => {
    if (profilesCache[userId]) return profilesCache[userId]
    const supabase = getSupabase()
    if (!supabase) return null
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .eq("user_id", userId)
      .maybeSingle()
    if (data) {
      setProfilesCache((c) => ({ ...c, [userId]: data as ProfileRow }))
      return data as ProfileRow
    }
    return null
  }, [profilesCache])

  const ensureProfileRef = useRef(ensureProfile)
  ensureProfileRef.current = ensureProfile

  const fetchProfiles = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return {}
    const supabase = getSupabase()
    if (!supabase) return {}
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", userIds)
    const map: Record<string, ProfileRow> = {}
    ;(data ?? []).forEach((r) => {
      map[(r as ProfileRow).user_id] = r as ProfileRow
    })
    setProfilesCache((c) => ({ ...c, ...map }))
    return map
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  // When current user profile updates (e.g. after Edit Profile save), sync cache and message display
  useEffect(() => {
    if (!appUser) return
    const avatarUrl =
      typeof appUser.avatar === "string" && appUser.avatar.startsWith("http") ? appUser.avatar : null
    setProfilesCache((c) => ({
      ...c,
      [appUser.id]: { user_id: appUser.id, display_name: appUser.name, avatar_url: avatarUrl },
    }))
    setMessages((prev) =>
      prev.map((m) =>
        m.sender_id === appUser.id
          ? { ...m, display_name: appUser.name, avatar_url: avatarUrl ?? m.avatar_url }
          : m
      )
    )
  }, [appUser?.id, appUser?.name, appUser?.avatar])

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase || !appUser) return

    chatLoadedRef.current = false
    let mounted = true
    let channelRealtime: ReturnType<typeof supabase.channel> | null = null
    let channelPresence: ReturnType<typeof supabase.channel> | null = null

    const run = async () => {
      try {
        const t0 = typeof window !== "undefined" ? performance.now() : 0
        let { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        if (!session?.user) {
          if (appUser) {
            await new Promise((r) => setTimeout(r, 400))
            const retry = await supabase.auth.getSession()
            session = retry.data.session
          }
          if (!mounted || !session?.user) {
            if (!redirectSent.current) {
              redirectSent.current = true
              console.log("[CHAT_GUARD]", {
                hasSession: !!session?.user,
                action: "redirect to /auth?next=/chat",
              })
              router.replace("/auth?next=/chat")
            }
            return
          }
        }
        if (!session?.user) return
        const currentSession = session
        authUserId.current = currentSession.user.id

        console.log("[chat] getOrCreateGlobalConversation start")
        let cid: string | null = await getGlobalConversationId(supabase)
        if (!cid && currentSession.access_token) {
          const res = await fetch("/api/chat/global", {
          headers: { Authorization: `Bearer ${currentSession.access_token}` },
        })
          if (res.ok) {
            const data = await res.json()
            if (data?.id) cid = data.id
          } else if (process.env.NODE_ENV === "development") {
            console.warn("[chat] /api/chat/global status", res.status, await res.text())
          }
        }
        if (!cid) {
          cid = await getOrCreateGlobalConversation(supabase)
        }
        if (typeof window !== "undefined") console.log("[chat] getOrCreateGlobalConversation done", { cid, ms: Math.round(performance.now() - t0) })
        if (!mounted) return
        if (!cid) {
          setError(
            "Global chat room not found. Run supabase-chat-migration.sql in Supabase → SQL Editor (creates the room). Set SUPABASE_SERVICE_ROLE_KEY in .env.local for API fallback."
          )
          setLoading(false)
          return
        }
        setGlobalId(cid)

        await supabase.from("conversation_members").upsert(
          { conversation_id: cid, user_id: currentSession.user.id, role: "member" },
          { onConflict: "conversation_id,user_id" }
        )

        console.log("[chat] messages fetch start")
        const { data: rows, error: fetchErr } = await supabase
          .from("messages")
          .select("id, conversation_id, sender_id, body, created_at")
          .eq("conversation_id", cid)
          .eq("is_deleted", false)
          .order("created_at", { ascending: true })

        if (!mounted) return
        if (typeof window !== "undefined") console.log("[chat] messages fetch done", { count: (rows ?? []).length })
        if (fetchErr) {
          console.error("[chat] messages fetch", fetchErr)
          toast.error(fetchErr.message)
          setError(fetchErr.message)
          setLoading(false)
          return
        }

        const list = (rows ?? []) as MessageRow[]
        const senderIds = [...new Set(list.map((m) => m.sender_id))]
        const profileMap = await fetchProfiles(senderIds)
        const withProfile: MessageWithProfile[] = list.map((m) => {
          const p = profileMap[m.sender_id]
          return {
            ...m,
            display_name: p?.display_name ?? "Unknown",
            avatar_url: p?.avatar_url ?? null,
          }
        })
        setMessages(withProfile)
        chatLoadedRef.current = true
        setLoading(false)
        cachedGlobalId = cid
        cachedMessages = withProfile

        channelRealtime = supabase
          .channel(`messages:${cid}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${cid}` },
            async (payload) => {
              if (!mounted || !payload.new) return
              const newRow = payload.new as MessageRow
              const p = await ensureProfileRef.current(newRow.sender_id)
              const withProfile: MessageWithProfile = {
                ...newRow,
                display_name: p?.display_name ?? "Unknown",
                avatar_url: p?.avatar_url ?? null,
              }
              setMessages((prev) => {
                if (prev.some((m) => m.id === withProfile.id)) return prev
                const next = [...prev, withProfile]
                if (cid === cachedGlobalId) cachedMessages = next
                return next
              })
            }
          )
          .subscribe((status) => {
            if (typeof window !== "undefined") console.log("[RT] status", status)
          })

        channelPresence = supabase.channel(PRESENCE_CHANNEL, {
          config: { presence: { key: currentSession.user.id } },
        })
        channelPresence
          .on("presence", { event: "sync" }, () => {
            if (!mounted || !channelPresence) return
            const state = channelPresence.presenceState() as Record<string, Array<{ user_id?: string }>>
            const ids = Object.entries(state)
              .flatMap(([, payloads]) => payloads?.map((p) => p.user_id).filter(Boolean) ?? [])
            setOnlineUserIds((prev) => {
              const next = [...new Set(ids)] as string[]
              return next.length === prev.length && next.every((id, i) => id === prev[i]) ? prev : next
            })
          })
          .subscribe(async (status) => {
            if (status === "SUBSCRIBED" && channelPresence) {
              await channelPresence.track({ user_id: currentSession.user.id })
            }
          })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error("[chat] run error", err)
        toast.error(msg)
        setError(msg)
        setLoading(false)
      }
    }

    const timeoutId = setTimeout(() => {
      if (mounted && !chatLoadedRef.current) {
        setError("Chat loading timed out. Check network and Supabase (conversations table, RLS).")
        setLoading(false)
      }
    }, 12000)

    run()
    return () => {
      mounted = false
      clearTimeout(timeoutId)
      channelRealtime?.unsubscribe()
      channelPresence?.unsubscribe()
    }
  }, [appUser?.id, router, fetchProfiles])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || !globalId || !authUserId.current || sending) return

    setSending(true)
    const supabase = getSupabase()
    if (!supabase) {
      setSending(false)
      return
    }
    const { data: inserted, error: insertErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: globalId,
        sender_id: authUserId.current,
        body: text,
      })
      .select("id, conversation_id, sender_id, body, created_at")
      .single()

    if (insertErr) {
      console.error("[chat] send message", insertErr)
      toast.error(insertErr.message)
      setSending(false)
      return
    }

    setInput("")
    if (inserted) {
      const newMsg: MessageWithProfile = {
        ...inserted,
        display_name: appUser?.name ?? "Unknown",
        avatar_url:
          typeof appUser?.avatar === "string" && appUser.avatar.startsWith("http")
            ? appUser.avatar
            : null,
      }
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev
        return [...prev, newMsg]
      })
    }
    setSending(false)
  }, [input, globalId, sending, appUser?.name, appUser?.avatar])

  const onlineProfiles = useMemo(() => {
    return onlineUserIds.map((id) => {
      const p = profilesCache[id]
      return {
        user_id: id,
        display_name: p?.display_name ?? "Unknown",
        avatar_url: p?.avatar_url ?? null,
      }
    })
  }, [onlineUserIds, profilesCache])

  useEffect(() => {
    if (onlineUserIds.length === 0) return
    fetchProfiles(onlineUserIds)
  }, [onlineUserIds, fetchProfiles])

  if (!appUser) {
    return (
      <div data-e2e="CHAT_PAGE_MARKER" className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div data-e2e="CHAT_PAGE_MARKER" className="mx-auto max-w-2xl px-4 py-8 text-center space-y-4">
        <p className="text-sm text-destructive">{error}</p>
        <p className="text-xs text-muted-foreground">
          File: te-pal-news-ui/supabase-chat-migration.sql
        </p>
        <Button variant="outline" className="mt-2" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  if (loading || !globalId) {
    return (
      <div data-e2e="CHAT_PAGE_MARKER" className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading chat...</p>
      </div>
    )
  }

  return (
    <div data-e2e="CHAT_PAGE_MARKER" className="mx-auto flex max-w-2xl flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>
      {/* DOM proof: this element exists only when /chat route is rendering */}
      <div data-e2e="CHAT_PAGE_MARKER" className="sr-only" aria-hidden="true">CHAT PAGE</div>
      {/* Header: title + Online (n) + online avatars — Chat UI임을 명확히 표시 */}
      <div className="flex flex-col border-b border-border bg-card">
        <div className="flex items-center gap-3 px-4 py-3">
          <h2 className="text-lg font-semibold text-foreground" data-page="chat">
            {GLOBAL_CHAT_TITLE}
          </h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Online ({onlineUserIds.length})
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2">
          <Users className="size-4 shrink-0 text-muted-foreground" />
          {onlineProfiles.length === 0 ? (
            <span className="text-xs text-muted-foreground">No one else online</span>
          ) : (
            <div className="flex gap-2">
              {onlineProfiles.map((p) => (
                <div key={p.user_id} className="flex shrink-0 items-center gap-1.5">
                  <Avatar className="size-7 border-2 border-background">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                      {(p.display_name ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-[80px] truncate text-xs text-foreground">
                    {p.display_name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === authUserId.current
            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
              >
                {!isOwn && (
                  <Avatar className="size-7 mt-1 shrink-0">
                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                      {msg.display_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[75%] space-y-0.5 ${isOwn ? "items-end" : "items-start"}`}
                >
                  {!isOwn && (
                    <p className="text-[10px] text-muted-foreground font-medium px-1">
                      {msg.display_name}
                    </p>
                  )}
                  <div
                    className={
                      isOwn
                        ? "rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground"
                        : "rounded-2xl rounded-bl-md bg-muted px-3.5 py-2 text-sm text-foreground"
                    }
                  >
                    {msg.body}
                  </div>
                  <p
                    className={`text-[10px] text-muted-foreground px-1 ${
                      isOwn ? "text-right" : "text-left"
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-card p-3 pb-safe">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            className="flex-1 h-10 text-sm"
            disabled={sending}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || sending}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
