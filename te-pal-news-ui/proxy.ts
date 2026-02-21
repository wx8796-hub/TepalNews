import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { AUTH_COOKIE_NAME } from "@/lib/auth-cookie"

const PUBLIC_PATHS = ["/auth", "/api", "/_next", "/favicon.ico"]
const DEV_BYPASS_ENV = "NEXT_PUBLIC_DEV_BYPASS_AUTH"

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true
  if (pathname.startsWith("/_next/") || pathname.includes(".")) return true
  return false
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const hasSupabase = typeof url === "string" && url.length > 0 && typeof anonKey === "string" && anonKey.length > 0

  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname === "/auth"
  const isProtected = !isPublicPath(pathname)

  const devBypass =
    process.env.NODE_ENV === "development" && process.env[DEV_BYPASS_ENV] === "true"

  if (!hasSupabase) {
    if (isProtected && !devBypass) {
      const res = NextResponse.redirect(new URL("/auth", request.url))
      res.headers.set("x-redirect-reason", "mw:no-supabase-to-auth")
      return res
    }
    return NextResponse.next({ request })
  }

  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null
  let user: { id: string } | null = null
  if (accessToken) {
    const supabase = createClient(url!, anonKey!, { auth: { persistSession: false } })
    const { data } = await supabase.auth.getUser(accessToken)
    user = data.user
  }

  if (devBypass) {
    return NextResponse.next({ request })
  }

  if (user && isAuthPage) {
    const res = NextResponse.redirect(new URL("/", request.url))
    res.headers.set("x-redirect-reason", "mw:user-on-auth-to-home")
    return res
  }

  if (!user && isProtected) {
    const authUrl = new URL("/auth", request.url)
    authUrl.searchParams.set("next", pathname)
    const res = NextResponse.redirect(authUrl)
    res.headers.set("x-redirect-reason", `mw:no-session-to-auth?next=${pathname}`)
    return res
  }

  return NextResponse.next({ request })
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
