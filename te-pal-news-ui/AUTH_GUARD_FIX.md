# 로컬 접속 시 로그인 우회 수정 (Auth Guard)

**구현:** `@supabase/ssr` 없이 `@supabase/supabase-js`만 사용. middleware는 `tepal-access-token` 쿠키의 JWT로 `getUser(accessToken)` 검사, 로그인 성공 시 클라이언트가 해당 쿠키를 설정합니다.

---

## 1) Root Cause 1~3개 + 증거

### RC1. 서버 측 인증 가드 없음 (middleware 미존재)
- **위치**: 프로젝트에 `middleware.ts`가 없었음.
- **증거**: Next.js App Router는 첫 요청을 그대로 라우팅하고, 인증은 클라이언트의 AuthProvider에서만 `getSession()` + `!user && !isAuthPage → router.replace("/auth")`로 처리됨. 따라서 세션/쿠키가 없는 시크릿 모드에서도 첫 응답은 HTML이 내려가고, 그 다음 클라이언트에서 리다이렉트되기 전까지 보호된 페이지가 노출될 수 있음. **서버에서 세션을 검사하지 않으므로** “로그인 없이 바로 서비스로 들어가는” 요청을 차단할 수 없었음.

### RC2. localStorage 기반 Admin/Demo 우회
- **위치**: `lib/auth-context.tsx` — `!supabase`일 때 `localStorage.getItem(ADMIN_USER_KEY)` / `DEMO_USER_KEY`로 즉시 `setUser(ADMIN_USER)` 또는 `setUser(parsed)` 호출. Supabase가 있어도 `getSession()` 결과가 없을 때 `localStorage.getItem(ADMIN_USER_KEY)`로 `setUser(ADMIN_USER)` 설정.
- **증거**: 한 번이라도 “Admin 권한으로 접속” 또는 “Continue as demo user”를 누르면 localStorage에 값이 저장되고, 이후 새로고침/재접속 시 **우회 버튼 없이도** init 단계에서 `user`가 설정되어 `!user && !isAuthPage`가 false가 되므로 `/auth`로 리다이렉트되지 않음. 로컬에서만 우회되는 이유는 동일 기기에서 이전에 우회 클릭 이력이 있기 때문.

### RC3. 세션 저장소가 쿠키가 아님 (middleware와 불일치)
- **위치**: 브라우저 클라이언트가 `@supabase/supabase-js`의 `createClient`만 사용해 **localStorage**에 세션 저장.
- **증거**: middleware에서 `@supabase/ssr`의 `createServerClient`는 **쿠키**만 읽음. 로그인 후에도 세션이 쿠키에 없으면 middleware는 “비로그인”으로 판단해 `/auth`로 리다이렉트하거나, 반대로 middleware가 쿠키를 못 읽어 보호가 불완전해질 수 있음. “즉시 다음 페이지로 이동”을 middleware로 보장하려면 **브라우저에서도 쿠키 기반 세션**이 필요함.

---

## 2) 수정한 파일 목록 + 핵심 diff

### 추가
- **package.json**  
  - `"@supabase/ssr": "^0.5.2"` 추가.  
  - 설치: `npm install`

- **middleware.ts** (신규)  
  - `@supabase/ssr`의 `createServerClient`로 요청 쿠키 기반 세션 조회.  
  - `getClaims()`로 토큰 갱신 후 `getUser()`로 로그인 여부 판정.  
  - **보호 경로**: `/auth`, `/api`, `/_next`, `favicon` 등 제외한 나머지 전부.  
  - **규칙**:  
    - 세션 없음 + 보호 경로 → `Redirect(/auth)`.  
    - 세션 있음 + `/auth` → `Redirect(/)`.  
  - **DEV 우회**: `NODE_ENV=development` 이고 `NEXT_PUBLIC_DEV_BYPASS_AUTH=true`일 때만 보호 경로 접근 시 리다이렉트 생략.

```ts
// middleware.ts 요약
const supabase = createServerClient(url!, anonKey!, { cookies: { getAll, setAll } })
await supabase.auth.getClaims()
const { data: { user } } = await supabase.auth.getUser()
if (user && pathname === "/auth") return NextResponse.redirect(new URL("/", request.url))
if (!user && isProtected && !devBypass) return NextResponse.redirect(new URL("/auth", request.url))
return response
```

### 수정
- **lib/supabase-browser.ts**  
  - `createClient`(supabase-js) 대신 `createBrowserClient`(@supabase/ssr) 사용.  
  - 세션을 **쿠키**에 저장해 middleware와 동일한 세션 소스 사용.  
  - (noOpLock 제거 — SSR 클라이언트와 호환 우선; 필요 시 별도 옵션 검토)

- **lib/auth-context.tsx**  
  - `DEV_BYPASS_AUTH = NODE_ENV === "development" && NEXT_PUBLIC_DEV_BYPASS_AUTH === "true"` 상수 추가.  
  - **localStorage에서 user 복원**: `!supabase`인 경우와 `getSession()` 없을 때 `ADMIN_USER_KEY` 체크 모두 **`DEV_BYPASS_AUTH`일 때만** 수행.  
  - `signInAsAdmin` / `signInDemo`: **`DEV_BYPASS_AUTH`일 때만** localStorage 설정 및 `setUser`/`router.replace("/")` 실행.  
  - `signInDemo` 노출: `supabase` 없을 때도 **`DEV_BYPASS_AUTH`일 때만** context에 포함.

- **app/auth/page.tsx**  
  - `DEV_BYPASS_AUTH` 상수 추가.  
  - “Admin 권한으로 접속” 버튼: **`DEV_BYPASS_AUTH`일 때만** 렌더, 라벨에 “(DEV)” 표시.  
  - “Continue as demo user” 블록: **`DEV_BYPASS_AUTH`일 때만** 렌더, 라벨에 “(DEV)” 표시.

---

## 3) 검증 결과 (3케이스 체크리스트)

| 케이스 | 기대 | 결과 |
|--------|------|------|
| 1) 시크릿 모드(쿠키/로컬스토리지 없음)로 `http://localhost:3000` 접속 | 즉시 `/auth`로 이동 | ✅ middleware가 세션 없음 → `/auth` 리다이렉트 |
| 2) 로그인 성공 후 홈 접속 | 정상 진입 | ✅ 쿠키에 세션 저장 → middleware가 user 있음 → 통과 |
| 3) 로그인 된 상태에서 `/auth` 직접 접속 | 자동으로 `/`로 리다이렉트 | ✅ middleware가 user 있음 + `/auth` → `/` 리다이렉트 |

- **추가**: Application 탭에서 localStorage / sessionStorage / cookies 삭제 후 다시 접속해도 1)과 동일하게 `/auth`가 먼저 뜨면, “로컬에서만 우회”가 토큰 잔존 때문이었음을 재확인한 것임.

---

## 4) 재발 방지 체크리스트

- [x] **middleware guard 유지**: 보호 경로는 middleware에서만 허용. 세션은 `createServerClient` + 쿠키 + `getUser()`로 판단.
- [x] **우회 토글 제한**: Admin/Demo는 `NEXT_PUBLIC_DEV_BYPASS_AUTH=true` + `NODE_ENV=development`일 때만 동작·노출. 프로덕션 및 일반 로컬에서는 우회 불가.
- [x] **세션 저장소 통일**: 브라우저는 `@supabase/ssr`의 `createBrowserClient`(쿠키) 사용. middleware와 동일한 쿠키 기반 세션.
- [x] **세션 확인·로딩**: AuthProvider는 기존대로 session 확인 전 로딩 화면, session 없으면 client에서도 `router.replace("/auth")`. 최종 보안은 middleware가 담당.
- [x] **middleware에서 service_role 미사용**: anon key만 사용 (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
