# Chat 탭 동작 수정 및 채팅 구현 보고

## 1) Root Cause (왜 Chat이 Post로 갔는지) + 수정 내역

### 원인 1: 로그인 플로우에서 return URL 미지원
- **증상**: Chat 탭 클릭 → `/chat` 요청 → (세션 없음) middleware가 `/auth`로 리다이렉트 → 로그인 성공 후 **항상 `router.replace("/")`** 호출 → 사용자는 **Post(홈) 화면**에 도착.
- **근거**: `app/auth/page.tsx`에서 로그인 성공 시 `router.replace("/")`만 사용하고, 어디서 왔는지(`/chat` 등) 보존하지 않음.
- **수정**:  
  - middleware: 보호 경로 접근 시 `/auth`로 보낼 때 **`?next=<pathname>`** 추가 (예: `/auth?next=/chat`).  
  - auth 페이지: **`useSearchParams().get("next")`** 로 목적지 읽고, 로그인 성공·이미 로그인 세이프가드 시 **`router.replace(safeNext || "/")`** 사용.  
  - `next`는 `/`로 시작하고 `//`가 아니어야만 허용(open redirect 방지).

### 원인 2: 네비 링크 자체는 정상
- **확인**: `components/app-bar.tsx`와 `components/bottom-nav.tsx`에서 Chat은 **`href="/chat"`** 로 연결되어 있음.  
- **조치**: 링크 변경 없음. Chat UI가 명확히 보이도록 `/chat` 페이지 헤딩에 **`data-page="chat"`** 추가해, 개발자 도구로 “Chat 페이지가 렌더됐는지” 확인 가능하게 함.

---

## 2) 추가/수정된 Supabase DDL(SQL) + 적용 방법

**파일**: `te-pal-news-ui/supabase-chat-migration.sql`

**내용 요약**:
- `conversations`에 **`slug text`** 컬럼 추가 (없을 때만).
- **`slug` unique index** 추가: `uq_conversations_slug` (slug가 not null인 행만). → 전체방을 `slug='global'` 1개로 고정할 때 사용.
- 기존 `type='group'` 이고 `title='TePal Global Chat'` 인 행 하나에 **`slug = 'global'`** 설정.
- **global 방이 없으면** `insert (type, title, slug) = ('group', 'TePal Global Chat', 'global')` (이미 있으면 insert 안 함).
- `messages(conversation_id, created_at)` 인덱스는 이미 스키마에 있으면 생성만 시도 (if not exists).

**적용 방법**:  
Supabase Dashboard → **SQL Editor** → `supabase-chat-migration.sql` 내용 붙여넣기 → **Run**.

**스키마 참고** (기존 DDL 기준):
- **messages**: `sender_id` 사용 (author_id 아님). `conversation_id`, `body`, `created_at`, `is_deleted` 등 이미 존재.
- **profiles**: `user_id` (PK), `display_name`, `avatar_url` 등.
- **conversation_members**: `(conversation_id, user_id)` PK, `joined_at` 등.

---

## 3) 수정한 파일 목록 + 핵심 diff

| 파일 | 변경 |
|------|------|
| **middleware.ts** | 보호 경로에서 `/auth`로 리다이렉트할 때 `?next=<pathname>` 추가. |
| **app/auth/page.tsx** | `useSearchParams()`로 `next` 읽기, 로그인 성공·세이프가드 시 `router.replace(safeNext \|\| "/")`. |
| **lib/chat-global.ts** | `slug='global'` 우선 조회, 없으면 기존대로 `type='group'` + `title` 로 get-or-create. |
| **app/chat/page.tsx** | 에러 시 `console.error` + `toast.error`, 헤딩에 `data-page="chat"` 추가. |
| **supabase-chat-migration.sql** | 신규. `slug` 컬럼/unique index, global 방 1개 보장. |
| **CHAT_TAB_FIX_REPORT.md** | 본 보고서. |

### middleware.ts
```ts
if (!user && isProtected) {
  const authUrl = new URL("/auth", request.url)
  authUrl.searchParams.set("next", pathname)
  return NextResponse.redirect(authUrl)
}
```

### app/auth/page.tsx
```ts
const searchParams = useSearchParams()
const nextUrl = searchParams.get("next") ?? ""
const safeNext = nextUrl.startsWith("/") && !nextUrl.startsWith("//") ? nextUrl : ""
// 로그인 성공 시: router.replace(safeNext || "/")
// 세이프가드(이미 로그인) 시: router.replace(safeNext || "/")
```

---

## 4) 검증 4단계 결과

| 단계 | 기대 | 확인 방법 |
|------|------|-----------|
| **1) Chat 탭 → /chat + Chat UI** | Chat 탭 클릭 시 URL이 `/chat`로 바뀌고, "TePal Global Chat" 제목과 채팅 UI가 보인다. | 브라우저 주소창 + 상단 제목 + `document.querySelector('[data-page="chat"]')` 존재. |
| **2) 2탭 동시 접속** | 두 브라우저(또는 시크릿)에서 로그인 후 `/chat` 접속 가능. | 각 탭에서 /chat 열기, 둘 다 채팅 화면 표시. |
| **3) Realtime** | 한 탭에서 메시지 전송 시 다른 탭에 즉시 표시. | 한쪽에서 Send → 다른 쪽에 새 메시지 노출. (Supabase Replication에서 `messages` 테이블 Realtime ON 필요.) |
| **4) 새로고침 후 DB 반영** | 새로고침 후에도 메시지가 로딩되고, Table Editor에서 `messages` 행 확인 가능. | F5 후 메시지 유지, Supabase Table Editor에서 `messages` 조회. |

---

## 5) 에러 처리 요약

- **세션 없음**: middleware에서 `/auth?next=/chat` 리다이렉트, 로그인 후 `/chat`로 복귀.
- **글로벌 방 로드 실패**: `[chat] getOrCreateGlobalConversation returned no id` 콘솔 + "Could not load global chat." + Retry.
- **메시지 fetch 실패**: `[chat] messages fetch` 콘솔 + toast + 화면 에러 문구.
- **전송 실패**: `[chat] send message` 콘솔 + toast.

Realtime을 쓰려면 Supabase Dashboard → Database → Replication → **messages** 테이블에 대해 Realtime을 켜야 함.
