# TePal Global Chat — 단일 그룹채팅방 산출물

## 1) 수정/추가한 파일 목록

| 파일 | 변경 |
|------|------|
| **lib/chat-global.ts** | 신규. `getOrCreateGlobalConversation(supabase)`, `GLOBAL_CHAT_TITLE` |
| **app/chat/page.tsx** | 전면 교체. 대화 목록 제거 → 단일 "TePal Global Chat" UI, 메시지 로드/전송/Realtime, Presence 온라인 목록, 세션 가드 |
| **CHAT_GLOBAL_DELIVERABLE.md** | 신규. 본 산출물 |

기존 **app/chat/[id]/page.tsx**, **app/chat/new/page.tsx**는 그대로 두었음(다른 경로에서 참조 시 활용). `/chat` 진입 시에는 목록 없이 바로 글로벌 방만 보이도록 함.

---

## 2) 핵심 diff(코드블록)

### lib/chat-global.ts (신규)

```ts
const GLOBAL_TITLE = "TePal Global Chat"

export async function getOrCreateGlobalConversation(supabase: SupabaseClient): Promise<string | null> {
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("type", "group")
    .eq("title", GLOBAL_TITLE)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existing?.id) return existing.id

  const { data: inserted, error } = await supabase
    .from("conversations")
    .insert({ type: "group", title: GLOBAL_TITLE })
    .select("id")
    .single()

  if (!error && inserted?.id) return inserted.id

  const { data: fallback } = await supabase
    .from("conversations")
    .select("id")
    .eq("type", "group")
    .eq("title", GLOBAL_TITLE)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  return fallback?.id ?? null
}
```

### app/chat/page.tsx 요약

- **세션**: `getSession()` 없으면 `router.replace("/auth")`.
- **글로벌 방**: `getOrCreateGlobalConversation(supabase)` → `globalId` 확보.
- **멤버**: `conversation_members`에 `(conversation_id, user_id)` upsert (`onConflict: "conversation_id,user_id"`).
- **메시지 로드**: `messages`에서 `conversation_id=globalId`, `is_deleted=false`, `created_at` 오름차순. `sender_id`로 `profiles` 조회해 `display_name`, `avatar_url` 매핑.
- **전송**: `messages.insert({ conversation_id, sender_id, body })`, `sender_id`는 세션 user id.
- **Realtime**: `postgres_changes`, `event: "INSERT"`, `table: "messages"`, `filter: conversation_id=eq.${globalId}`. 새 행 수신 시 id로 dedupe 후 append.
- **Presence**: `channel("presence:global-chat", { presence: { key: user.id } })`, `track({ user_id })`, `sync` 시 payload에서 `user_id` 수집 → 온라인 목록. 해당 `user_id`로 `profiles` 조회해 상단에 아바타/이름 표시.
- **UI**: 상단 "TePal Global Chat" + Online (n) + 온라인 유저 목록, 중앙 메시지 리스트, 하단 입력 + Send.

---

## 3) DB에서 global conversation이 1개만 생기는 근거

- **조건**: `type = 'group'` AND `title = 'TePal Global Chat'`.
- **로직**:  
  1) 위 조건으로 `order by created_at asc limit 1` 조회.  
  2) 있으면 해당 `id` 반환.  
  3) 없으면 `insert({ type: 'group', title: 'TePal Global Chat' })` 후 반환.  
  4) insert 실패(예: 동시 생성) 시 같은 조건으로 다시 select → 가장 오래된 1개 반환.
- **중복 방지(선택)**: Supabase SQL Editor에서 아래 실행 시 동시 insert로 2개 생기는 경우를 방지할 수 있음.

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_global
ON public.conversations(type, title)
WHERE type = 'group' AND title = 'TePal Global Chat';
```

이후 insert 시 동일 (type, title)이면 conflict → get-or-create 시 select만 하면 됨.

---

## 4) 실시간 메시지 수신 / 온라인 표시 검증 절차

1. **Realtime 활성화**: Supabase Dashboard → Database → Replication → `public.messages` 테이블에 대해 “Realtime” ON.
2. **브라우저 2개**: 일반 창 + 시크릿(또는 다른 브라우저). 각각 로그인 후 `/chat` 접속.
3. **메시지**: 한쪽에서 메시지 전송 → 다른 쪽에 즉시 표시되는지 확인.
4. **온라인**: 상단 “Online (n)” 및 아바타/이름에 두 사용자 모두 보이는지 확인. 한쪽 탭을 닫으면 해당 사용자가 목록에서 사라지는지 확인.

---

## 5) 에러 처리(네트워크/권한/세션 없음) UX

| 상황 | 동작 |
|------|------|
| **세션 없음** | `getSession()` 결과 없으면 `router.replace("/auth")`. middleware도 `/chat`을 보호 경로로 두어 미인증 시 `/auth` 리다이렉트. |
| **글로벌 방 조회/생성 실패** | `getOrCreateGlobalConversation`이 null 반환 시 화면에 "Could not load global chat." + Retry 버튼. |
| **메시지 로드 실패** | fetch error 시 `setError(message)`, 동일하게 에러 문구 + Retry. |
| **전송 실패** | `messages.insert` error 시 `toast.error(message)`, 입력값 유지해 재전송 가능. |
| **Realtime 끊김** | Supabase 클라이언트 재연결 시 자동 재구독. 네트워크 오류 시 새 메시지는 상대측에서만 보일 수 있음 → 새로고침 시 동기화. |

---

## 스키마 참고 (supabase-schema-v1.sql 기준)

- **conversations**: `id`, `type` (dm | group), `title`, `dm_key`, `created_by`, `created_at`, `updated_at`
- **messages**: `id`, `conversation_id`, **`sender_id`**, `body`, `is_deleted`, `created_at`, `updated_at`  
  (요구사항의 author_id는 스키마상 **sender_id**로 구현)
- **conversation_members**: `conversation_id`, `user_id`, `role`, `joined_at`, `last_read_at` (PK: conversation_id, user_id)
- **profiles**: `user_id`, `display_name`, `avatar_url`, ...
