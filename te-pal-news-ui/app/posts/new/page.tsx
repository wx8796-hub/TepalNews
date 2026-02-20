"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, X, ImagePlus, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { usePosts } from "@/lib/posts-context"
import { useAuth } from "@/lib/auth-context"
import type { Post } from "@/lib/mock-data"

const postTypes = [
  { value: "photo", label: "Photo" },
  { value: "update", label: "Update" },
  { value: "english-tip", label: "English Tip" },
] as const

type PostType = (typeof postTypes)[number]["value"]

export default function CreatePostPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { addPost } = usePosts()
  if (!user) return null
  const [type, setType] = useState<PostType>("update")
  const [content, setContent] = useState("")
  const [title, setTitle] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [tagInput, setTagInput] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag])
      setTagInput("")
    }
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_IMAGE_SIZE_MB = 10
  const MAX_IMAGE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const remaining = 10 - images.length
    if (remaining <= 0) {
      toast.error("Maximum 10 images allowed.")
      e.target.value = ""
      return
    }
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, remaining)
    for (const file of imageFiles) {
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`Image "${file.name}" is over ${MAX_IMAGE_SIZE_MB}MB. Please choose a smaller file.`)
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

  const addImage = () => {
    if (images.length >= 10) {
      toast.error("Maximum 10 images allowed.")
      return
    }
    fileInputRef.current?.click()
  }

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
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
    await new Promise((r) => setTimeout(r, 500))

    const newPost: Post = {
      id: "", // server generates uuid
      type,
      author: user,
      content: content.trim(),
      likes: 0,
      comments: 0,
      liked: false,
      createdAt: "Just now",
    }
    if (title.trim()) newPost.title = title.trim()
    if (tags.length > 0) newPost.tags = [...tags]
    if (linkUrl.trim()) newPost.linkUrl = linkUrl.trim()
    if (images.length > 0) newPost.media = [...images]

    try {
      const saved = await addPost(newPost)
      toast.success("Posted!")
      router.push(`/posts/${saved.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save post")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" /> Back
      </button>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
        <h1 className="text-xl font-bold text-foreground">Create Post</h1>

        {/* Post type segmented */}
        <div className="space-y-2">
          <Label>Post type</Label>
          <div className="flex rounded-lg border border-border p-1 bg-muted">
            {postTypes.map((pt) => (
              <button
                key={pt.value}
                onClick={() => setType(pt.value)}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all",
                  type === pt.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <Label htmlFor="content">
            {"What's new?"} <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="content"
            placeholder="Share something with TePal members..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[120px] resize-none"
          />
          {errors.content && (
            <p className="text-xs text-destructive">{errors.content}</p>
          )}
        </div>

        {/* Image uploader */}
        <div className="space-y-2">
          <Label>Images (optional, max 10)</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageSelect}
          />
          <div className="flex flex-wrap gap-2">
            {images.map((url, i) => (
              <div
                key={i}
                className="relative size-20 rounded-lg overflow-hidden border border-border bg-muted flex-shrink-0"
              >
                <img
                  src={url}
                  alt={`Upload ${i + 1}`}
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:opacity-90"
                  aria-label="Remove image"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {images.length < 10 && (
              <button
                type="button"
                onClick={addImage}
                className="flex size-20 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <ImagePlus className="size-5" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Click + to upload from your device. Supported: JPG, PNG, GIF, WebP.
          </p>
        </div>

        {/* Title (optional) */}
        <div className="space-y-2">
          <Label htmlFor="title">
            Title (optional)
            {type === "english-tip" && (
              <span className="ml-1 text-xs text-accent">Recommended for English Tips</span>
            )}
          </Label>
          <Input
            id="title"
            placeholder="Give your post a title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Link URL */}
        {(type === "english-tip" || linkUrl) && (
          <div className="space-y-2">
            <Label htmlFor="link-url">
              <Link2 className="inline size-3 mr-1" />
              Link URL (optional)
            </Label>
            <Input
              id="link-url"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            {errors.linkUrl && (
              <p className="text-xs text-destructive">{errors.linkUrl}</p>
            )}
            {type === "english-tip" && (
              <p className="text-xs text-muted-foreground">
                Add a link to a helpful resource or article.
              </p>
            )}
          </div>
        )}

        {/* Tags */}
        <div className="space-y-2">
          <Label>Tags (optional)</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Add a tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={addTag} disabled={!tagInput.trim()}>
              Add
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {"#"}{tag}
                  <button onClick={() => removeTag(tag)}>
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => router.back()} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !content.trim()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Post"}
          </Button>
        </div>
      </div>
    </div>
  )
}
