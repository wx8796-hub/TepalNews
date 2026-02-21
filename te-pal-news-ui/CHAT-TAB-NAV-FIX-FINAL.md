# Chat 탭 클릭 시 Post 화면 대신 채팅방이 보이도록 수정 (최종)

## 1) Root Cause 1~3 + 증거

### Root Cause 1: Chat 탭이 `<Link>` + `<Button asChild>` 조합이라 클릭이 Link로 전달되지 않는 경우
- **증거**: `components/app-bar.tsx` — Chat이 `<Button asChild><Link href="/chat">` 로 되어 있음. 일부 환경에서 Button이 포커스/클릭을 가로채거나, 스타일/이벤트 버블링으로 인해 **실제 네비게이션이 발생하지 않을 수 있음**. URL이 /chat으로 바뀌지 않으면 화면은 계속 이전 페이지(Post/Home)가 유지됨.
- **확정 방법**: Chat 클릭 후 주소창이 /chat으로 바뀌는지 확인. 바뀌지 않으면 1-A(네비 문제).

### Root Cause 2: URL은 /chat인데 화면이 Post처럼 보이는 경우(라우트 충돌)
- **증거**: `app/` 아래에 `app/[slug]/page.tsx` 또는 `app/[...catchAll]/page.tsx` 같은 **동적 세그먼트**가 있으면 /chat이 해당 라우트로 매칭될 수 있음. 현재 레포에는 **동적 라우트가 없음** (app/chat/page.tsx, app/page.tsx 등만 존재). next.config에 rewrites/redirects로 /chat → / 가 없음. middleware는 /chat을 / 로 보내지 않고, 비로그인 시 /auth?next=/chat 만 사용.
- **확정 방법**: /chat 직접 입력 시 DOM에 `[data-e2e="CHAT_PAGE_MARKER"]` 가 있는지 확인. 없으면 1-B(라우트 충돌 또는 잘못된 페이지 렌더).

### Root Cause 3: 모바일 하단 네비에서도 Chat이 Link인데, 동일 이슈 가능
- **증거**: `components/bottom-nav.tsx` — Chat이 `navItems`의 Link로만 되어 있어, 상단과 동일하게 **명시적 router.push** 가 없으면 일관성 없을 수 있음.
- **조치**: 상단/하단 모두 Chat 클릭 시 **router.push("/chat")** 로 통일.

---

## 2) 수정한 파일 목록 + 핵심 diff

### 2-1. `components/app-bar.tsx`

- Chat을 **Link 대신 Button + onClick** 으로 변경. **router.push("/chat")** 만 호출하도록 해 네비게이션을 코드로 확정.
- `[NAV] chat clicked`, `[NAV] pushed /chat` 로그 추가.
- `data-e2e="nav-chat-link"` 로 DOM에서 Chat 버튼 식별 가능.

```ts
import { usePathname, useRouter } from "next/navigation"

const router = useRouter()
const handleChatClick = () => {
  console.log("[NAV] chat clicked")
  router.push("/chat")
  console.log("[NAV] pushed /chat")
}

<Button
  variant={pathname.startsWith("/chat") ? "secondary" : "ghost"}
  size="sm"
  type="button"
  onClick={handleChatClick}
  data-e2e="nav-chat-link"
>
  <MessageCircle className="size-4" />
  <span>Chat</span>
</Button>
```

### 2-2. `components/bottom-nav.tsx`

- Chat 항목만 **Link 대신 button + router.push("/chat")** 로 처리.
- 동일하게 `[NAV] chat clicked (bottom)`, `[NAV] pushed /chat` 및 `data-e2e="nav-chat-link"` 추가.

### 2-3. `app/chat/page.tsx`

- **DOM 마커**: 모든 return 분기(비로그인 로딩, 에러, 로딩, 본문)에 `data-e2e="CHAT_PAGE_MARKER"` 가진 루트 요소 추가.
- **렌더 로그**: 컴포넌트 본문에 `console.log("[CHAT_PAGE] rendered")` 추가.
- 본문 최상단에 `<div data-e2e="CHAT_PAGE_MARKER" class="sr-only">CHAT PAGE</div>` 추가해, /chat이 실제로 이 페이지로 렌더될 때 DOM으로 증명 가능하게 함.

```ts
console.log("[CHAT_PAGE] rendered")

if (!appUser) return <div data-e2e="CHAT_PAGE_MARKER" ...>Loading...</div>
if (error) return <div data-e2e="CHAT_PAGE_MARKER" ...>...
if (loading || !globalId) return <div data-e2e="CHAT_PAGE_MARKER" ...>Loading chat...</div>
return (
  <div data-e2e="CHAT_PAGE_MARKER" ...>
    <div data-e2e="CHAT_PAGE_MARKER" className="sr-only">CHAT PAGE</div>
    ...
  </div>
)
```

---

## 3) 충돌 여부 전수 조사 결과

- **동적 라우트**: `app/[slug]/page.tsx`, `app/[...catchAll]/page.tsx` 등 **없음**. `/chat` 은 `app/chat/page.tsx` 만 매칭.
- **next.config.mjs**: rewrites/redirects **없음**. `/chat` → `/` 로 보내는 규칙 없음.
- **middleware.ts**: `/chat` 은 보호 경로. 비로그인 시 **/auth?next=/chat** 로만 리다이렉트하며, `/` 로 덮어쓰지 않음.

---

## 4) 검증 1~4 결과

| # | 항목 | 확인 |
|---|------|------|
| 1 | Chat 클릭 → URL이 /chat 로 변경 + DOM에 CHAT_PAGE_MARKER 존재 | ☐ |
| 2 | 주소창에 /chat 직접 입력 → 동일하게 CHAT_PAGE_MARKER 보임 | ☐ |
| 3 | (로그아웃 상태) /chat → /auth?next=/chat → 로그인 후 /chat 복귀 | ☐ |
| 4 | 어떤 경우에도 Chat 클릭 시 Post 화면이 렌더되지 않음 | ☐ |

- **URL 확인**: Chat 클릭 직후 주소창이 `http://localhost:3000/chat` 인지 확인.
- **DOM 확인**: 개발자 도구 Elements에서 `[data-e2e="CHAT_PAGE_MARKER"]` 검색 시 1개 이상 노출되는지 확인.
- **콘솔**: `[NAV] chat clicked`, `[NAV] pushed /chat`, `[CHAT_PAGE] rendered` 로 클릭 → 라우팅 → 채팅 페이지 렌더 흐름 확인.
