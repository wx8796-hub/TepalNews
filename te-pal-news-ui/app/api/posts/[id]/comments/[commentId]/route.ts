import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"
import { getRequestUser, isAdminUserId } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string; commentId: string }> }

/** DELETE comment. Allowed only for comment author or admin (wx8796). */
export async function DELETE(request: Request, { params }: Params) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }
  const { commentId } = await params
  const auth = await getRequestUser(request)
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { data: comment, error: fetchErr } = await supabaseAdmin
    .from("comments")
    .select("id, author_id")
    .eq("id", commentId)
    .single()
  if (fetchErr || !comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 })
  }
  const authorId = comment.author_id as string
  const canDelete =
    auth.userId === authorId || isAdminUserId(auth.userId, auth.email)
  if (!canDelete) {
    return NextResponse.json(
      { error: "Only the author or an admin can delete this comment" },
      { status: 403 }
    )
  }
  const { error } = await supabaseAdmin.from("comments").delete().eq("id", commentId)
  if (error) {
    console.error("comments DELETE", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
