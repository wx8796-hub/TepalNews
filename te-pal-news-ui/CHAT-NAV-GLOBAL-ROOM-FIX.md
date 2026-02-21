# Chat 탭 → /chat 즉시 이동 + 글로벌 채팅방 바로 열기

## 1) Root Cause 1~3 + 증거

### Root Cause 1: AuthProvider가 loading 중에도 redirect해서 /chat 진입 직후 /auth로 덮어씀 (이미 이전 수정에서 해결)
- **증거**: `lib/auth-context.tsx` — `!user && !isAuthPage`일 때 무조건 `router.replace("/auth")`를 호출하면, 세션 로딩이 끝나기 전에 /chat으로 갔다가 곧바로 /auth로 바뀌어 “Chat 눌러도 /chat에 안 간다”처럼 보임.
- **해결**: 동일 세션에서 이미 “redirect는 loading 끝난 뒤에만, next 파라미터 포함”으로 수정됨.

### Root Cause 2: /chat에서 세션 없을 때 redirect가 여러 번 호출될 수 있음
- **증거**: `app/chat/page.tsx`의 `run()` 안에서 `!session?.user`일 때 `router.replace("/auth?next=/chat")`를 호출. React strict mode나 effect 재실행 시 redirect가 중복되면 라우팅/히스토리가 꼬일 수 있음.
- **해결**: `redirectSent` ref로 한 번만 redirect 하도록 처리.

### Root Cause 3: conversations에 slug가 없을 때 getGlobalConversationId/insert 실패
- **증거**: `lib/chat-global.ts`에서 `.eq("slug", GLOBAL_SLUG)` 조회, 그리고 insert 시 `slug` 포함. DDL에 `slug`가 없으면(마이그레이션 미실행) 쿼리/insert 오류로 글로벌 방을 못 찾거나 못 만들 수 있음.
- **해결**: slug 조회를 try/catch로 감싸고, insert는 slug 포함 시도 후 실패 시 slug 없이 재시도. API도 slug 조회 실패 시 type+title로 fallback, insert도 slug 실패 시 slug 없이 insert.

---

## 2) 수정한 파일 목록 + 핵심 diff

### 2-1. `app/chat/page.tsx`

- **페이지 마운트 로그**: `useEffect` 안에서 `console.log("[chat] page mounted", { path })` 한 번 실행.
- **redirect 1회만**: `redirectSent` ref 추가, `!session?.user`일 때 `if (!redirectSent.current) { redirectSent.current = true; router.replace("/auth?next=/chat") }`.
- **getOrCreate / messages 로그**: `getOrCreateGlobalConversation` 시작 시 `[chat] getOrCreateGlobalConversation start`, 완료 시 `[chat] getOrCreateGlobalConversation done`, `cid`, 소요 ms. 메시지 fetch 직전 `[chat] messages fetch start`, 완료 시 `[chat] messages fetch done`, `count`.

```ts
const redirectSent = useRef(false)
// ...
useEffect(() => { console.log("[chat] page mounted", ...) }, [])
// in run():
if (!session?.user) {
  if (!redirectSent.current) {
    redirectSent.current = true
    console.log("[chat] no session, redirecting to /auth?next=/chat")
    router.replace("/auth?next=/chat")
  }
  return
}
console.log("[chat] getOrCreateGlobalConversation start")
// ... get cid ...
console.log("[chat] getOrCreateGlobalConversation done", { cid, ms })
console.log("[chat] messages fetch start")
// ... fetch ...
console.log("[chat] messages fetch done", { count })
```

### 2-2. `lib/chat-global.ts`

- **getGlobalConversationId**: slug 조회를 try/catch로 감싸고, 예외 시 type+title 조회만 사용.
- **getOrCreateGlobalConversation**: 먼저 `slug: GLOBAL_SLUG` 포함해서 insert 시도, 실패(에러/예외) 시 slug 없이 insert 재시도.

```ts
try {
  const { data: bySlug, error: slugErr } = await supabase...
  if (!slugErr && bySlug?.id) return bySlug.id
} catch { /* slug column may not exist */ }
// type+title select...

// insert: try with slug first, then without
try {
  const { data: inserted, error: insertErr } = await supabase
    .from("conversations")
    .insert({ ...payload, slug: GLOBAL_SLUG })
    ...
  if (!insertErr && inserted?.id) return inserted.id
} catch { }
const { data: inserted, ... } = await supabase
  .from("conversations")
  .insert(payload)
  ...
```

### 2-3. `app/api/chat/global/route.ts`

- **slug 조회**: `bySlugRes.error`를 보고, 에러면 type+title 경로로 fallback.
- **insert**: `slug: GLOBAL_SLUG` 포함 insert 시도, 실패 시 slug 없이 insert 후 성공 시 `{ id }` 반환.
- **에러 로그**: 최종 실패 시 `err` 변수 사용하도록 수정.

---

## 3) Supabase 마이그레이션 SQL (기존 파일 참고)

글로벌 방 1개 보장 및 slug 사용을 위해 `supabase-chat-migration.sql` 실행 권장:

- `conversations`에 `slug text` 추가.
- `slug` unique index (where slug is not null).
- 기존 "TePal Global Chat" 1개에 `slug = 'global'` 설정.
- global 방이 없으면 `insert (type, title, slug) values ('group', 'TePal Global Chat', 'global')`.

이미 레포에 있으므로 Supabase SQL Editor에서 해당 파일 내용 실행하면 됨.

---

## 4) 검증 1~4 결과

| # | 항목 | 확인 |
|---|------|------|
| 1 | Chat 클릭 → 1초 내 /chat 이동 + "TePal Global Chat" UI 표시 | ☐ |
| 2 | 주소창에 /chat 직접 입력 → 동일하게 글로벌 채팅방 표시 | ☐ |
| 3 | 로그아웃 상태에서 Chat 클릭 → /auth?next=/chat → 로그인 후 /chat 복귀 | ☐ |
| 4 | 브라우저 2탭에서 /chat 동시 접속 → 한쪽 전송 시 다른 쪽에 Realtime 표시 | ☐ |

**디버깅**: 콘솔에서 `[chat] page mounted`, `[chat] getOrCreateGlobalConversation start/done`, `[chat] messages fetch start/done`, `[nav] Chat clicked` 로그로 진입·글로벌 방 확보·메시지 로드 구간 확인 가능.
