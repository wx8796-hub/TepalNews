import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { mapRowToPost, postToRow } from "@/lib/posts-api"
import type { Post } from "@/lib/mock-data"

export const dynamic = "force-dynamic"

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) {
    console.error("posts GET", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const posts = (data ?? []).map((row) => mapRowToPost(row as Parameters<typeof mapRowToPost>[0]))
  return NextResponse.json(posts)
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }
  let body: Post
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const row = postToRow(body)
  const { data, error } = await supabaseAdmin.from("posts").insert(row).select().single()
  if (error) {
    console.error("posts POST", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(mapRowToPost(data as Parameters<typeof mapRowToPost>[0]))
}
