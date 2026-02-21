# Vercel 배포 시 환경 변수 설정

로컬에서는 `.env.local`이 있어서 Supabase가 연결되지만, **Vercel에는 .env.local이 올라가지 않습니다.**  
배포된 사이트에서 Supabase(로그인, 포스트, 채팅 등)를 쓰려면 Vercel에 환경 변수를 넣어야 합니다.

## 설정 방법

1. [Vercel 대시보드](https://vercel.com/dashboard) → **TePal News** 프로젝트 선택  
2. **Settings** → **Environment Variables**  
3. 아래 변수들을 **Production, Preview, Development** 모두 체크하고 추가

## 필수 변수

| Name | Value | 비고 |
|------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabase 대시보드 → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` | 같은 화면 → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` | 같은 화면 → service_role key (비공개 유지) |

## 선택 변수

| Name | Value | 비고 |
|------|--------|------|
| `SUPABASE_ADMIN_UID` | UUID | Admin으로 포스트할 auth 사용자 UUID (Auth → Users에서 복사) |

## 적용 (중요)

- 변수 추가/수정 후 **저장**
- **캐시 없이 재배포**가 반드시 필요합니다.  
  `NEXT_PUBLIC_*` 값은 **빌드 시점**에 클라이언트 JS에 박히기 때문에, 예전(캐시된) 빌드를 쓰면 계속 "Supabase: not configured"로 나옵니다.
  1. **Deployments** → 맨 위(최신) 배포 행 → **⋮** (세 점) → **Redeploy**
  2. **"Use existing Build Cache"** 가 있으면 **체크 해제** 후 Redeploy
  3. 새 배포가 끝날 때까지 기다린 뒤, 배포된 URL로 접속 (캐시 없이 새로고침 또는 시크릿 창)

이후 "Supabase: connected"로 바뀌고 로그인/포스트/채팅이 동작합니다.
