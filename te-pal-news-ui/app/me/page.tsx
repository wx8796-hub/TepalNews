"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { LogOut, Pencil, Heart, FileText, ImagePlus } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { PostCard } from "@/components/post-card"
import { toast } from "sonner"
import { usePosts } from "@/lib/posts-context"
import { currentUser } from "@/lib/mock-data"

function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return currentUser.avatar
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return trimmed.slice(0, 2).toUpperCase()
}

export default function ProfilePage() {
  const { posts } = usePosts()
  const myPosts = posts.filter((p) => p.author.id === currentUser.id)
  const likedPosts = posts.filter((p) => p.liked)
  const [displayName, setDisplayName] = useState(currentUser.name)
  const [bio, setBio] = useState(currentUser.bio || "")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem("tepale_profile_avatar")
    if (stored) setAvatarUrl(stored)
  }, [])

  const profileInitials = getInitials(displayName)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      setAvatarUrl(url)
      if (typeof window !== "undefined") window.localStorage.setItem("tepale_profile_avatar", url)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleSave = () => {
    toast.success("Profile updated!")
    setEditOpen(false)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      {/* Profile header */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <Avatar className="size-16">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" className="object-cover" />}
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
              {profileInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{bio || "No bio yet"}</p>
            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="size-3" />
                {myPosts.length} posts
              </span>
              <span className="flex items-center gap-1">
                <Heart className="size-3" />
                {likedPosts.length} liked
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Pencil className="size-4" /> Edit profile
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Profile</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Avatar (optional)</Label>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <div className="flex items-center gap-3">
                    <Avatar className="size-14">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt="" className="object-cover" />}
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {profileInitials}
                      </AvatarFallback>
                    </Avatar>
                    <Button type="button" variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()}>
                      <ImagePlus className="size-4" /> Upload photo
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Display name</Label>
                  <Input
                    id="edit-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-bio">Bio</Label>
                  <Textarea
                    id="edit-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="resize-none"
                    rows={3}
                  />
                </div>
                <Button className="w-full" onClick={handleSave}>
                  Save changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" asChild>
            <Link href="/auth">
              <LogOut className="size-4" /> Log out
            </Link>
          </Button>
        </div>
      </div>

      {/* Posts tabs */}
      <Tabs defaultValue="my-posts">
        <TabsList className="w-full">
          <TabsTrigger value="my-posts" className="flex-1">My posts</TabsTrigger>
          <TabsTrigger value="liked" className="flex-1">Liked</TabsTrigger>
        </TabsList>
        <TabsContent value="my-posts" className="mt-4 space-y-3">
          {myPosts.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="mx-auto size-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                You haven{"'"}t posted anything yet.
              </p>
              <Button size="sm" className="mt-3" asChild>
                <Link href="/posts/new">Create your first post</Link>
              </Button>
            </div>
          ) : (
            myPosts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </TabsContent>
        <TabsContent value="liked" className="mt-4 space-y-3">
          {likedPosts.length === 0 ? (
            <div className="py-12 text-center">
              <Heart className="mx-auto size-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                No liked posts yet.
              </p>
            </div>
          ) : (
            likedPosts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
