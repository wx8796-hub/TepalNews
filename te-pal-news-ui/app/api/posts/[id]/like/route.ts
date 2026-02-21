import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { getRequestUserIdFromBody } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/** POST { liked: boolean, userId?: "admin" }. Toggle like for current user. */
export async function POST(request: Request, { params }: Params) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }
  const { id: postId } = await params
  let body: { liked?: boolean; userId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const auth = await getRequestUserIdFromBody(request, body)
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { userId } = auth
  const liked = body.liked === true

  if (liked) {
    const { error } = await supabaseAdmin
      .from("post_likes")
      .insert({ post_id: postId, user_id: userId })
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ ok: true, liked: true })
      }
      console.error("post_likes insert", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, liked: true })
  } else {
    const { error } = await supabaseAdmin
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId)
    if (error) {
      console.error("post_likes delete", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, liked: false })
  }
}
