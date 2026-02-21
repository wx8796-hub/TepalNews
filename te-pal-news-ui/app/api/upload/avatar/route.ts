import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

const AVATARS_BUCKET = "avatars"

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 })
  }
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim()
  if (!token) {
    return NextResponse.json({ error: "Missing authorization" }, { status: 401 })
  }
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }
  const file = formData.get("file") ?? formData.get("avatar")
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file (field: file or avatar)" }, { status: 400 })
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 })
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 80)
  const path = `${user.id}/${Date.now()}-${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabaseAdmin.storage
    .from(AVATARS_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error("avatar upload", uploadError)
    return NextResponse.json(
      { error: uploadError.message || "Upload failed. Ensure bucket 'avatars' exists and is public." },
      { status: 500 }
    )
  }

  const { data: urlData } = supabaseAdmin.storage.from(AVATARS_BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: urlData.publicUrl })
}
