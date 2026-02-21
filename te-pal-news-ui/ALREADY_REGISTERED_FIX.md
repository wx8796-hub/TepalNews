# "This email is already registered" 원인 규명 및 수정

## 1) Root Cause (1~2개) + 증거

### RC1. auth.users에 이미 동일 이메일이 존재 (Supabase 정상 동작)
- **사실**: Supabase Auth는 **auth.users**에 동일 email이 있으면 `signUp`을 "already registered" 유사 메시지로 실패시킨다. **profiles** 테이블과 무관하다.
- **증거**: 레포에서 해당 메시지는 **프론트에서 매핑**하고 있음.
  - **위치**: `app/auth/page.tsx` 104~105행 (검색 결과)
  - **코드**: `if (err.message.includes("already registered") ...) setError("This email is already registered. Please sign in.")`
  - 즉, Supabase가 반환한 `error.message`에 "already registered"가 포함되면 프론트가 위 문구로 치환해 표시한다. 실제 API 응답은 Network → `/auth/v1/signup` → Response body에서 확인 가능 (예: `{"msg":"User already registered",...}` 또는 유사).
- **Supabase Dashboard**: Authentication → Users에서 해당 이메일이 이미 있으면, 이는 **정상 동작**이며 RC1이 원인이다.

### RC2. Supabase URL/KEY mismatch (다른 프로젝트를 바라봄)
- **가능성**: 로컬 또는 Vercel의 env가 **다른 프로젝트**를 가리키면, 한쪽에서는 “이미 가입됨”이 나오고 다른 쪽에서는 안 나올 수 있다.
- **증거 수집 방법**:
  1. 회원가입 버튼 클릭 시 DevTools → Network에서 **`/auth/v1/signup`** 요청 선택.
  2. **Request URL**의 host 확인: 기대값은 **`akvfoqyukyfryofqgqpd.supabase.co`**.
  3. 다르면 (예: `xxxxx.supabase.co`) → 해당 환경(로컬 `.env.local` 또는 Vercel Environment Variables)의 `NEXT_PUBLIC_SUPABASE_URL`이 잘못 설정된 것이 1순위 원인.
- **배포(Vercel)**: 빌드 시점에 `NEXT_PUBLIC_*`가 번들에 박히므로, Vercel 대시보드에서 해당 프로젝트의 Environment Variables에 `NEXT_PUBLIC_SUPABASE_URL=https://akvfoqyukyfryofqgqpd.supabase.co` 등이 올바르게 설정돼 있어야 한다.

---

## 2) 수정한 파일 목록 + 핵심 diff

### `app/auth/page.tsx`
- **signUp 전**: `console.info("[signUp] supabase host:", new URL(supabaseUrl).host)` (URL 유효할 때만). URL 없으면 `console.warn("[signUp] NEXT_PUBLIC_SUPABASE_URL is undefined")`.
- **signUp 에러 시**: `console.error("signUp error", { status, message, name })` 로 **원본 에러** 로깅. UI에는 기존처럼 친절 문구 유지.
- **이미 가입된 이메일 UX**:
  - `alreadyRegisteredEmail` / `resetSent` / `authTab` state 추가.
  - "already registered" 유형 에러 시 → "This email is already registered. Please sign in or reset your password." + **"Log in instead"** 버튼(로그인 탭으로 전환) + **"Send password reset email"** 버튼 (`supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/auth' })`).
- **Host 진단**: Supabase 연결 시 상태 문구 아래에 `Host: {supabaseHost}` 표시 (mounted + supabaseHost 있을 때). 기대값: `akvfoqyukyfryofqgqpd.supabase.co`.
- **ensureProfile**: 로그인 성공 시 `ensureProfile(session.access_token, user.user_metadata)` 호출로 profiles upsert 보장.
- Tabs를 **controlled**로 변경: `value={authTab}`, `onValueChange`로 전환 시 에러/이미가입 상태 초기화.

### `lib/auth-context.tsx`
- **ensureProfile(accessToken, metadata)** 추가: `POST /api/auth/profile` 호출 (Bearer token + name/bio from metadata).
- **init** 및 **onAuthStateChange**에서 `session?.user`일 때 `ensureProfile(session.access_token, session.user.user_metadata)` 호출 후 `fetchProfile`. → 이메일 인증 후 최초 로그인 시에도 profiles 행 생성/갱신.

---

## 3) 검증 절차

1. **Host 확인 (로컬 / 베르셀)**
   - `/auth` 접속 후 상태 문구 아래 **Host:** 값 확인.
   - 기대: **`akvfoqyukyfryofqgqpd.supabase.co`**. 다르면 해당 환경의 `NEXT_PUBLIC_SUPABASE_URL` 수정 후 재빌드/재시작.

2. **신규 이메일로 가입**
   - Sign up (이메일/비번/이름) → 성공 시 토스트.
   - Supabase Dashboard: **Authentication → Users**에 해당 사용자 생성 확인.
   - **Table Editor → public.profiles**에 해당 `user_id`로 행 존재 확인 (ensureProfile 또는 기존 profile API로 생성).

3. **이미 가입된 이메일로 가입 시도**
   - 동일 이메일로 다시 Sign up → "This email is already registered. Please sign in or reset your password." 표시.
   - **"Log in instead"** 클릭 → 로그인 탭으로 전환.
   - **"Send password reset email"** 클릭 → 토스트 "Check your email...", 해당 이메일로 재설정 링크 수신 확인 (redirectTo: `/auth`).

4. **Network로 원인 확인**
   - 회원가입 클릭 시 **Network**에서 `signup` 요청의 **Request URL** host = `akvfoqyukyfryofqgqpd.supabase.co` 인지 확인.
   - 실패 시 **Response** body와 **Console**의 `signUp error` 로그(status, message, name)로 Supabase가 준 원인 확인.

---

## 4) 재발 방지 체크리스트

- [ ] **Env 이름**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Next.js는 `NEXT_PUBLIC_` 접두사). 로컬은 `te-pal-news-ui/.env.local`에 설정.
- [ ] **Env 값**: `NEXT_PUBLIC_SUPABASE_URL` = `https://akvfoqyukyfryofqgqpd.supabase.co` (끝에 슬래시 없음). Vercel에서도 동일하게 설정 후 Redeploy.
- [ ] **재시작**: `.env.local` 수정 후 `npm run dev` 재시작. Vercel은 env 수정 후 Redeploy.
- [ ] **Host 진단**: 배포/로컬에서 auth 페이지의 "Host:"가 `akvfoqyukyfryofqgqpd.supabase.co`인지 주기적으로 확인.
- [ ] **에러 로깅**: signUp 실패 시 `console.error("signUp error", { status, message, name })` 유지. UI에는 사용자 친화 문구 표시.
- [ ] **ensureProfile**: 로그인 성공 시(auth 페이지) + onAuthStateChange(SIGNED_IN) 시(auth-context) profiles upsert 호출 유지.
