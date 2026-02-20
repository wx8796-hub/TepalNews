"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Search, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { users, currentUser } from "@/lib/mock-data"

const otherUsers = users.filter((u) => u.id !== currentUser.id)

export default function NewChatPage() {
  const router = useRouter()
  const [tab, setTab] = useState<"dm" | "group">("dm")

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("type") === "group") setTab("group")
  }, [])
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [groupName, setGroupName] = useState("")
  const [error, setError] = useState("")

  const filteredUsers = otherUsers.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  )

  const toggleUser = (id: string) => {
    if (tab === "dm") {
      setSelected([id])
    } else {
      setSelected((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      )
    }
    setError("")
  }

  const handleCreate = () => {
    if (selected.length === 0) {
      setError("Select at least one member.")
      return
    }
    if (tab === "group" && selected.length < 2) {
      setError("Groups require at least 3 members (including you).")
      return
    }
    toast.success(tab === "dm" ? "Chat created!" : "Group created!")
    router.push("/chat/ch1")
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" /> Back
      </button>

      <h1 className="text-xl font-bold text-foreground mb-4">New Chat</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full mb-4">
          <TabsTrigger value="dm" className="flex-1">Direct message</TabsTrigger>
          <TabsTrigger value="group" className="flex-1">Group chat</TabsTrigger>
        </TabsList>

        <TabsContent value="dm" className="space-y-4">
          <MemberPicker
            users={filteredUsers}
            selected={selected}
            search={search}
            onSearch={setSearch}
            onToggle={toggleUser}
            singleSelect
          />
        </TabsContent>

        <TabsContent value="group" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group name (optional)</Label>
            <Input
              id="group-name"
              placeholder="e.g. English Study Group"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>
          <MemberPicker
            users={filteredUsers}
            selected={selected}
            search={search}
            onSearch={setSearch}
            onToggle={toggleUser}
          />
        </TabsContent>
      </Tabs>

      {/* Selected members */}
      {selected.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const user = users.find((u) => u.id === id)
            if (!user) return null
            return (
              <Badge key={id} variant="secondary" className="gap-1">
                {user.name}
                <button onClick={() => toggleUser(id)}>
                  <X className="size-3" />
                </button>
              </Badge>
            )
          })}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <div className="mt-6">
        <Button className="w-full" onClick={handleCreate} disabled={selected.length === 0}>
          Create
        </Button>
      </div>
    </div>
  )
}

function MemberPicker({
  users: memberUsers,
  selected,
  search,
  onSearch,
  onToggle,
  singleSelect = false,
}: {
  users: typeof otherUsers
  selected: string[]
  search: string
  onSearch: (s: string) => void
  onToggle: (id: string) => void
  singleSelect?: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>
      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {memberUsers.map((user) => {
          const isSelected = selected.includes(user.id)
          return (
            <button
              key={user.id}
              onClick={() => onToggle(user.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors text-left",
                isSelected ? "bg-primary/5" : "hover:bg-muted"
              )}
            >
              <Avatar className="size-9">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {user.avatar}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{user.name}</p>
                {user.bio && (
                  <p className="text-xs text-muted-foreground truncate">{user.bio}</p>
                )}
              </div>
              {isSelected && (
                <div className="flex size-5 items-center justify-center rounded-full bg-primary">
                  <Check className="size-3 text-primary-foreground" />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
