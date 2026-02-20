"use client"

import { useState, useRef, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, X, ImagePlus, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { usePosts } from "@/lib/posts-context"
import { currentUser } from "@/lib/mock-data"
import type { Post } from "@/lib/mock-data"

const postTypes = [
  { value: "photo", label: "Photo" },
  { value: "update", label: "Update" },
  { value: "english-tip", label: "English Tip" },
] as const

type PostType = (typeof postTypes)[number]["value"]

const MAX_IMAGE_SIZE_MB = 10
const MAX_IMAGE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

export default function EditPostPage() {
  const params = useParams()
  const router = useRouter()
  const { posts, updatePost } = usePosts()
  const post = posts.find((p) => p.id === params.id)
  const isOwn = post?.author.id === currentUser.id

  const [type, setType] = useState<PostType>("update")
  const [content, setContent] = useState("")
  const [title, setTitle] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [tagInput, setTagInput] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!post) return
    if (!isOwn) {
      toast.error("You don't have permission to edit this post.")
      router.push(`/posts/${post.id}`)
      return
    }
    setType(post.type)
    setContent(post.content)
    setTitle(post.title ?? "")
    setLinkUrl(post.linkUrl ?? "")
    setTags(post.tags ?? [])
    setImages(post.media ?? [])
  }, [post, isOwn, router])

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag])
      setTagInput("")
    }
  }

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag))

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const remaining = 10 - images.length
    if (remaining <= 0) {
      toast.error("Maximum 10 images allowed.")
      e.target.value = ""
      return
    }
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, remaining)
    for (const file of imageFiles) {
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`Image over ${MAX_IMAGE_SIZE_MB}MB. Choose a smaller file.`)
        e.target.value = ""
        return
      }
    }
    imageFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        if (result) setImages((prev) => [...prev, result])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ""
  }

  const removeImage = (index: number) => setImages(images.filter((_, i) => i !== index))

  const handleSubmit = async () => {
    if (!post) return
    const newErrors: Record<string, string> = {}
    if (!content.trim()) newErrors.content = "Write something first."
    if (linkUrl.trim()) {
      try {
        const u = new URL(linkUrl.trim())
        if (u.protocol !== "https:" && u.protocol !== "http:") {
          newErrors.linkUrl = "Link must start with https (or http)."
        }
      } catch {
        newErrors.linkUrl = "Please enter a valid URL."
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    setLoading(true)
    await new Promise((r) => setTimeout(r, 400))
    updatePost(post.id, {
      type,
      content: content.trim(),
      title: title.trim() || undefined,
      linkUrl: linkUrl.trim() || undefined,
      tags: tags.length > 0 ? [...tags] : undefined,
      media: images.length > 0 ? [...images] : undefined,
    })
    setLoading(false)
    toast.success("Post updated!")
    router.push(`/posts/${post.id}`)
  }

  if (!post) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Post not found.</p>
      </div>
    )
  }

  if (!isOwn) return null

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href={`/posts/${post.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
        <h1 className="text-xl font-bold text-foreground">Edit Post</h1>

        <div className="space-y-2">
          <Label>Post type</Label>
          <div className="flex rounded-lg border border-border p-1 bg-muted">
            {postTypes.map((pt) => (
              <button
                key={pt.value}
                onClick={() => setType(pt.value)}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all",
                  type === pt.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Content <span className="text-destructive">*</span></Label>
          <Textarea
            id="content"
            placeholder="Share something with TePal members..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[120px] resize-none"
          />
          {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
        </div>

        <div className="space-y-2">
          <Label>Images (optional, max 10)</Label>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
          <div className="flex flex-wrap gap-2">
            {images.map((url, i) => (
              <div key={i} className="relative size-20 rounded-lg overflow-hidden border border-border bg-muted flex-shrink-0">
                <img src={url} alt="" className="size-full object-cover" />
                <button type="button" onClick={() => removeImage(i)} className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {images.length < 10 && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex size-20 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary">
                <ImagePlus className="size-5" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Title (optional)</Label>
          <Input id="title" placeholder="Give your post a title..." value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="link-url"><Link2 className="inline size-3 mr-1" /> Link URL (optional)</Label>
          <Input id="link-url" placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
          {errors.linkUrl && <p className="text-xs text-destructive">{errors.linkUrl}</p>}
        </div>

        <div className="space-y-2">
          <Label>Tags (optional)</Label>
          <div className="flex gap-2">
            <Input placeholder="Add a tag..." value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} className="flex-1" />
            <Button variant="outline" size="sm" onClick={addTag} disabled={!tagInput.trim()}>Add</Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  #{tag}
                  <button onClick={() => removeTag(tag)}><X className="size-3" /></button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => router.back()} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !content.trim()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  )
}
