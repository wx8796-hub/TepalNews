import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * 배포 환경에서 서버가 Supabase env를 읽는지 확인용.
 * 브라우저에서 (배포 URL)/api/config/supabase/debug 로 열어보면 됨.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const hasUrl = typeof url === "string" && url.length > 0
  const hasAnonKey = typeof anonKey === "string" && anonKey.length > 0
  return NextResponse.json(
    {
      serverHasUrl: hasUrl,
      serverHasAnonKey: hasAnonKey,
      ok: hasUrl && hasAnonKey,
      hint: !hasUrl || !hasAnonKey
        ? "Vercel → Settings → Environment Variables 에서 이 배포 환경(Production/Preview)에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 설정 후 Redeploy (캐시 제거 권장)."
        : undefined,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
