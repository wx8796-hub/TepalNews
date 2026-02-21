# 로그인 스피너 무한 로딩 수정

## 1) Root Cause 1~3개 + 증거

### RC1. ensureProfile 대기로 라우팅이 실행되지 않음 (1차 수정으로 해결)
- **위치**: `app/auth/page.tsx` — 로그인 성공 시 `await ensureProfile(...)` 후에만 `router.replace("/")` 호출.
- **증거**: `ensureProfile`은 `POST /api/auth/profile`을 호출. 이 요청이 느리거나 타임아웃/실패 시 `await`가 끝나지 않아 `router.replace("/")`에 도달하지 못함. Network에서 `auth/v1/token` 200 후 `/api/auth/profile` 요청이 오래 걸리거나 pending이면 이 원인.
- **결과**: 스피너만 계속 돌고 화면 전환 없음. → **조치**: ensureProfile 비동기화, router.replace 우선 실행.

### RC2. session이 null인 경우(이메일 미인증) 메시지 없이 통과 (1차 수정으로 해결)
- **위치**: 동일 파일 — `if (data.session)` 블록만 있고, `data.session`이 null이면 아무 메시지도 설정하지 않고 try를 통과해 finally만 실행.
- **증거**: Supabase에서 "Confirm email"이 켜져 있으면 `signInWithPassword`가 성공해도 `data.session`이 null일 수 있음.
- **결과**: 로딩은 끝나지만 "이메일 인증 필요" 안내가 없음. → **조치**: `!data.session` 분기 추가, setError + toast.

### RC3. signInWithPassword가 영원히 resolve/reject 하지 않음 (2차 수정 대상)
- **위치**: `app/auth/page.tsx` — `await supabase.auth.signInWithPassword(...)` 호출 후 promise가 pending 상태로 남는 경우.
- **증거**:
  - **스피너 구분**: 무한 도는 스피너는 **버튼 내부** 스피너(React state `loading`)임. `/auth` 페이지의 `const [loading, setLoading] = useState(false)`에서만 제어. 라우트 로딩(loading.tsx)이 아님.
  - **setLoading(true) 검색 결과**: `setLoading(true)`는 `app/auth/page.tsx` 60행(handleLogin), 152행(handleSignup)에서만 호출됨. AuthProvider(`lib/auth-context.tsx`)의 `loading`은 별도 상태(전체 화면 "Loading...")이며, **auth 페이지 버튼 state와 무관**.
  - 따라서 "버튼 스피너가 안 꺼짐" = handleLogin의 **finally가 실행되지 않음** = **await signInWithPassword**에서 영원히 대기.
- **가능 원인**: POST `/auth/v1/token?grant_type=password` 요청이 pending(네트워크/CORS/프록시/확장 프로그램), 또는 Supabase 클라이언트 내부 hang.
- **조치**: `withTimeout(signInWithPassword(...), 8000, "signIn")` 적용. 8초 후 reject → catch → finally → setLoading(false) + toast.

### RC4. Next.js 라우팅이 가끔 막혀 성공 후에도 /auth에 머무름 (3차 수정)
- **위치**: `router.replace("/")` 호출 후에도 클라이언트가 `/auth`에 남는 경우.
- **증거**: signIn 200, session OK, router.replace 호출까지 완료했는데 화면만 안 바뀜. Next App Router의 클라이언트 네비게이션 이슈/경쟁 조건.
- **조치**: 성공 시 `router.replace("/")` 즉시 호출 후, 500ms 뒤 `window.location.pathname === "/auth"`이면 `window.location.assign("/")`로 fallback 이동. 추가로 `/auth` 마운트 시 `getSession()`으로 이미 세션이 있으면 즉시 `router.replace("/")` 하는 useEffect 세이프가드.

---

## 2) 수정한 파일 목록 + 핵심 diff

### 1차 수정 (기존)

**파일**: `app/auth/page.tsx` (handleLogin)

- **로딩/에러 보장**: 이미 `try/catch/finally`와 `setLoading(false)`가 있음. 모든 early return 경로에서도 `finally`가 실행되도록 유지.
- **에러 노출**: `if (err)` 시 `console.error("signInWithPassword", { message, status })` 추가. 사용자 메시지 `userMsg` 설정 후 `setError(userMsg)` + `toast.error(userMsg)`.
- **session null 처리**: `if (!data.session)` 분기 추가 → `setError` + `toast.error`("이메일 확인해 주세요") 후 `return`.
- **라우팅 우선**: `await ensureProfile(...)` 제거. 성공 시 `toast.success` → `router.replace("/")` → `router.refresh()` 먼저 실행. 그 다음 `ensureProfile(...).catch(...)`로 비동기 호출(await 없음)해 프로필은 라우팅 뒤에 처리.
- **개발 로그**: 로그인 시도 시 `[login] supabase host: <host>` (개발 모드), 성공 시 `[login] session OK, user id: <id>` 출력.
- **catch**: `console.error("handleLogin", e)` + `setError` + `toast.error` 추가.

### 2차 수정 (무한 스피너 타임아웃)

**추가 파일**: `lib/promise-utils.ts`

- `withTimeout<T>(promise, ms, label)`: `Promise.race`로 `ms` 초 후 reject. 8초(또는 10초) 이상 await가 걸리면 UI가 반드시 풀리도록 사용.

**수정 파일**: `app/auth/page.tsx` (handleLogin)

- **타임아웃**: `signInWithPassword`를 `withTimeout(..., 8000, "signIn")`으로 감쌈. 타임아웃 시 toast + setError + finally에서 setLoading(false).

### 3차 수정 (즉시 이동 + fallback + 세이프가드)

**수정 파일**: `app/auth/page.tsx`

- **최소 동작 리팩터**: handleLogin을 try/catch/finally만 유지. error 시 UI 에러 + return. session 없으면 안내 후 return. 성공 시 **추가 작업(ensureProfile) 절대 await 없음**, 라우팅 최우선.
- **즉시 라우팅**: 성공 시 `router.replace("/")` → `router.refresh()` 즉시 호출.
- **Fallback 네비게이션**: `router.replace("/")` 호출 후 `setTimeout(500ms)` 안에 `window.location.pathname === "/auth"`이면 `window.location.assign("/")` 실행. (Next.js 라우팅이 막혀도 500ms 뒤 강제 이동.)
- **세이프가드 useEffect**: `/auth` 마운트 시 `supabase.auth.getSession()` 호출, `session?.user` 있으면 즉시 `router.replace("/")`. (이미 로그인된 상태에서 /auth 접근 시 바로 "/"로; handleLogin 라우팅이 실패해도 세션만 있으면 리다이렉트.)
- **로딩 상태 분리**: 로그인 버튼 스피너는 `/auth` 페이지 로컬 `loading` state만 사용. setLoading(true/false)는 handleLogin 내부에서만 호출. (검색 결과: `setLoading(true)`는 auth/page.tsx의 handleLogin·handleSignup뿐; AuthProvider loading과 혼용 없음.)

```ts
// 3차 핵심 diff (handleLogin 성공 분기)
toast.success("Signed in!")
router.replace("/")
router.refresh()
setTimeout(() => {
  if (typeof window !== "undefined" && window.location.pathname === "/auth") {
    window.location.assign("/")
  }
}, 500)
ensureProfile(...).catch((e) => console.error("ensureProfile after login", e))
```

```ts
// 세이프가드 useEffect 추가
useEffect(() => {
  if (!supabase) return
  let cancelled = false
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (cancelled) return
    if (session?.user) router.replace("/")
  })
  return () => { cancelled = true }
}, [router])
```

---

## 3) 검증 결과

- **올바른 계정**: 로그인 버튼 클릭 후 **즉시(최대 1초 내)** `/`로 이동. `router.replace("/")` 호출 후 500ms 뒤에도 `/auth`에 남아 있으면 `window.location.assign("/")`로 fallback 이동. ensureProfile은 await 없이 fire-and-forget.
- **잘못된 비번/미인증**: 즉시 에러 표시 + 스피너 종료 + 토스트. finally에서 setLoading(false) 보장.
- **네트워크 차단/타임아웃**: 8초 내에 "signIn timeout (8000ms)" reject → catch → toast "Login timed out. Check network, CORS, and Supabase env." + setLoading(false). 스피너 10초 이상 지속되지 않음.
- **이미 로그인된 상태에서 /auth 접근**: 세이프가드 useEffect가 `getSession()`으로 세션 확인 후 즉시 `router.replace("/")`.

---

## 4) 재발 방지 체크리스트

- [x] **로딩**: `setLoading(true)` → try → (모든 경로에서) finally에서 `setLoading(false)`.
- [x] **타임아웃**: `signInWithPassword`를 `withTimeout(..., 8000, "signIn")`으로 감싸 10초 이상 스피너 유지 불가.
- [x] **로컬 loading 분리**: 로그인 버튼 스피너는 `/auth` 페이지 로컬 state만 사용. AuthProvider/SessionProvider/ensureProfile 로딩과 혼용하지 않음. setLoading은 handleLogin(및 handleSignup) 내부에서만 호출.
- [x] **await 제거**: 성공 시 ensureProfile 절대 await 없음. `.catch(...)`로만 후처리. 라우팅 최우선.
- [x] **fallback 이동**: `router.replace("/")` 후 500ms 뒤에도 `pathname === "/auth"`이면 `window.location.assign("/")` 실행.
- [x] **세이프가드**: `/auth` 마운트 시 세션 존재하면 즉시 `router.replace("/")`.
- [x] **에러 표시**: signIn error / session null / catch 시 setError + toast. 타임아웃 시 전용 토스트.
- [x] **중복 이벤트**: form `onSubmit`에 `e.preventDefault()` 적용, submit 버튼에 onClick 중복 없음.
