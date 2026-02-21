import { supabaseAdmin } from "@/lib/supabase-server"

/** Admin: id 또는 email이 wx8796으로 시작하는 계정 (프론트와 동일 기준) */
export function isAdminUserId(userId: string, email?: string | null): boolean {
  return Boolean(
    userId?.startsWith("wx8796") || email?.toLowerCase().startsWith("wx8796")
  )
}

/**
 * Resolve current user from request (header only). Returns userId and email for admin check.
 */
export async function getRequestUser(
  request: Request
): Promise<
  { userId: string; email?: string } | { error: string; status: number }
> {
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim()
  if (token && supabaseAdmin) {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (!error && user)
      return { userId: user.id, email: user.email ?? undefined }
    if (error) {
      console.error("getUser(token)", error)
      return { error: error.message, status: 401 }
    }
  }
  if (request.headers.get("x-user-id") === "admin") {
    const adminUid = process.env.SUPABASE_ADMIN_UID
    if (adminUid) return { userId: adminUid }
  }
  return { error: "Missing or invalid authorization", status: 401 }
}

/**
 * Resolve current user id from request (header only, does not consume body):
 * - Authorization: Bearer <access_token> → Supabase auth user id
 * - X-User-Id: admin + SUPABASE_ADMIN_UID set → admin uuid
 */
export async function getRequestUserId(
  request: Request
): Promise<{ userId: string } | { error: string; status: number }> {
  const result = await getRequestUser(request)
  if ("error" in result) return result
  return { userId: result.userId }
}

/** Use when request body may already be consumed; pass parsed body. */
export async function getRequestUserIdFromBody(
  request: Request,
  body: { userId?: string }
): Promise<{ userId: string } | { error: string; status: number }> {
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim()
  if (token && supabaseAdmin) {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (!error && user) return { userId: user.id }
    if (error) {
      console.error("getUser(token)", error)
      return { error: error.message, status: 401 }
    }
  }
  if (body?.userId === "admin") {
    const adminUid = process.env.SUPABASE_ADMIN_UID
    if (adminUid) return { userId: adminUid }
  }
  return { error: "Missing or invalid authorization", status: 401 }
}
