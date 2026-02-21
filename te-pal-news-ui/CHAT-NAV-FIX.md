# Chat 탭 클릭 시 /chat 즉시 이동 버그 수정

## 1) Root Cause (원인) + 증거

### Root Cause 1: AuthProvider가 loading 중에도 redirect해서 /chat 진입 직후 /auth로 덮어씀
- **설명**: 로그인된 사용자가 Chat을 눌러 `/chat`으로 이동해도, AuthProvider의 `useEffect`가 `user`만 보고 리다이렉트를 함. 초기 로드나 클라이언트 전환 직후에는 `user`가 아직 채워지지 않았을 수 있어, `!user && !isAuthPage`일 때 무조건 `router.replace("/auth")`를 호출함. 그 결과 URL이 `/chat`으로 바뀐 뒤 곧바로 `/auth`로 바뀌어 “Chat 눌러도 /chat으로 안 간다”처럼 보임.
- **증거**: `lib/auth-context.tsx` 191–197행 (수정 전)
  ```ts
  useEffect(() => {
    const isAuthPage = pathname === "/auth"
    if (!user && !isAuthPage) {
      router.replace("/auth")  // loading 여부 무관, next 없음
    }
  }, [user, pathname, router])
  ```
- **추가**: `loading`이 true인 동안은 리다이렉트하지 않도록 해야 함. 그리고 리다이렉트할 때 `next`를 넘기지 않아, 로그인 후에도 `/chat`으로 돌아가지 않음.

### Root Cause 2: /chat에서 세션 없을 때 /auth로 보낼 때 next 누락
- **설명**: `/chat` 페이지에서 `getSession()` 결과가 없으면 `router.replace("/auth")`만 호출해, 로그인 후 복귀 경로가 전달되지 않음.
- **증거**: `app/chat/page.tsx` 110–114행 (수정 전)
  ```ts
  if (!mounted || !session?.user) {
    router.replace("/auth")  // next=/chat 없음
    return
  }
  ```

### Root Cause 3: (선택) 로그인 후 “Go to app”이 항상 "/"
- **설명**: 이미 로그인된 상태에서 `/auth?next=/chat`으로 들어온 경우, “Go to app”이 `router.replace("/")`만 해서 `/chat`으로 가지 않음.
- **증거**: `app/auth/page.tsx` 281행 (수정 전)  
  `Button onClick={() => router.replace("/")}`

---

## 2) 수정 파일 목록 + 핵심 diff

### 2-1. `lib/auth-context.tsx`
- 리다이렉트를 **loading이 끝난 뒤**에만 수행.
- 리다이렉트 시 **`/auth?next=<pathname>`** 사용 (pathname이 있고 `/`가 아닐 때만 `next` 추가).

```diff
  // 로그인 안 된 상태면 로그인 화면으로 (loading과 무관하게)
  useEffect(() => {
+   if (loading) return
    const isAuthPage = pathname === "/auth"
    if (!user && !isAuthPage) {
-     router.replace("/auth")
+     const next = pathname && pathname !== "/" ? encodeURIComponent(pathname) : ""
+     router.replace(next ? `/auth?next=${next}` : "/auth")
    }
- }, [user, pathname, router])
+ }, [user, pathname, router, loading])
  // 로그인/회원가입 성공 시 앱으로 가는 건 auth 페이지에서 router.replace(safeNext || "/") 로 처리
```

### 2-2. `app/chat/page.tsx`
- 세션 없을 때 `/auth?next=/chat`으로 리다이렉트.

```diff
      if (!mounted || !session?.user) {
-       router.replace("/auth")
+       router.replace("/auth?next=/chat")
        return
      }
```

### 2-3. `components/app-bar.tsx`
- Chat 링크에 `data-nav="chat"` 및 클릭 시 `console.log("[nav] Chat clicked")` 추가 (동작 확인용).

```diff
          <Button variant={pathname.startsWith("/chat") ? "secondary" : "ghost"} size="sm" asChild>
-           <Link href="/chat">
+           <Link href="/chat" data-nav="chat" onClick={() => console.log("[nav] Chat clicked")}>
              <MessageCircle className="size-4" />
              <span>Chat</span>
            </Link>
```

### 2-4. `app/auth/page.tsx`
- `next=/chat`일 때 안내 문구 추가.
- 이미 로그인된 경우 “Go to app”이 `safeNext || "/"`로 이동하도록 수정.

```diff
  if (user && supabase) {
    ...
-   <Button onClick={() => router.replace("/")}>Go to app</Button>
+   <Button onClick={() => router.replace(safeNext || "/")}>Go to app</Button>
    ...
  }
  ...
+ {safeNext === "/chat" && (
+   <p className="mb-3 text-sm text-muted-foreground">Sign in to continue to Chat. You’ll be taken there after logging in.</p>
+ )}
  <Tabs value={authTab} ...>
```

---

## 3) 검증 결과 체크리스트

| # | 항목 | 결과 |
|---|------|------|
| 1 | 상단 Chat 클릭 → 1초 내 URL이 /chat으로 변경되고 채팅 UI 표시 | ☐ 통과 |
| 2 | 주소창에 직접 `http://localhost:3000/chat` 입력 → 채팅 UI 표시 | ☐ 통과 |
| 3 | 로그아웃 상태에서 Chat 클릭 → /auth로 이동 + 안내 문구 + 로그인 후 /chat으로 복귀 | ☐ 통과 |
| 4 | 어떤 경우에도 Chat 클릭 시 Post(홈) 화면이 뜨지 않음 | ☐ 통과 |

- **클릭 로그**: 브라우저 콘솔에서 Chat 클릭 시 `[nav] Chat clicked` 출력 여부로 이벤트 동작 확인 가능.
- **미들웨어**: 비로그인 시 `/chat` 요청은 이미 `middleware.ts`에서 `/auth?next=/chat`으로 리다이렉트됨. 클라이언트 쪽 AuthProvider/chat 페이지 수정으로 로그인 직후·전환 시에도 `next`가 유지되도록 맞춤.
