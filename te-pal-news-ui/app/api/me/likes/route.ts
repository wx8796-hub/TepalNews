import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { getRequestUser } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

/** Returns { [postId]: true } for posts the current user liked. Auth required. Small payload. */
export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }
  const auth = await getRequestUser(request)
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const postIds = url.searchParams.get("postIds")?.split(",").filter(Boolean) ?? []
  if (postIds.length === 0) {
    return NextResponse.json({})
  }

  const { data: rows } = await supabaseAdmin
    .from("post_likes")
    .select("post_id")
    .eq("user_id", auth.userId)
    .in("post_id", postIds)

  const liked: Record<string, boolean> = {}
  ;(rows ?? []).forEach((r: { post_id: string }) => {
    liked[r.post_id] = true
  })
  return NextResponse.json(liked)
}
