# Edit Profile → display_name 미반영 버그 수정

## 1) Root Cause (확정) + 증거

### Root Cause 1: upsert에 `updated_at` 미포함 + 충돌 타겟/구조 불일치 가능성
- **설명**: API가 `profiles`를 갱신할 때 **updated_at**을 payload에 넣지 않았고, **upsert(..., { onConflict: "user_id" })**만 사용함. 실제 DB가 PK로 **id**(uuid)를 쓰고 `user_id` 컬럼이 없거나 unique가 아니면 upsert가 실패하거나 해당 row를 갱신하지 않을 수 있음. 또한 upsert만 쓰면 “갱신”이 아니라 “삽입 또는 충돌 시 갱신”인데, conflict 타겟이 실제 PK와 다르면 0 row가 갱신될 수 있음.
- **증거**  
  - `app/api/auth/profile/route.ts` (수정 전):  
    - row에 `updated_at` 없음.  
    - `upsert(row, { onConflict: "user_id" })` 만 사용.  
  - Table Editor 기준으로 컬럼이 `role, display_name, bio, avatar_url, created_at, updated_at`만 보일 수 있고, **유저 식별 컬럼이 `id`일 수 있음** (가로 스크롤에 `id`가 숨겨져 있을 수 있음).

### Root Cause 2: WHERE/식별자 불일치
- **설명**: 레포 스키마(supabase-schema-v1.sql)는 **user_id uuid primary key**로 정의되어 있으나, 실제 배포된 DB는 **id uuid primary key**로 만들어져 있을 수 있음. 이 경우 `onConflict: "user_id"`로는 해당 row를 찾지 못해 **display_name이 갱신되지 않음**.
- **증거**:  
  - `supabase-schema-v1.sql` 35–36행: `user_id uuid primary key references auth.users(id)`.  
  - Table Editor 스크린샷에는 `user_id`가 없고 `id`만 있을 수 있음.

### Root Cause 3: 에러가 클라이언트에 전달되지만 로딩만 끝나고 메시지가 불명확한 경우
- **설명**: API가 500을 반환해도 클라이언트에서 `resData.error`를 제대로 파싱해 토스트로 보여주지 않으면 “저장이 안 된다”만 보이고 원인 파악이 어려움. 실패 시 **무한 로딩 방지**와 **콘솔 + 토스트** 노출이 필요함.
- **증거**: `app/me/page.tsx`에서 `profileRes.json().catch(() => ({}))` 후 `err.error`만 사용하고, status/전체 응답을 콘솔에 남기지 않음 (수정에서 보완).

---

## 2) 수정한 파일 목록 + 핵심 diff

### 2-1. `app/api/auth/profile/route.ts`

- **payload에 DB 컬럼명만 사용**: `display_name`, `bio`, `avatar_url`, **updated_at** (필수).
- **기존 row 조회**: `user_id`로 먼저 조회, 없으면 `id`로 조회.
- **갱신 방식**: **update** 사용.  
  1) `.update(payload).eq("user_id", user.id)`  
  2) 에러가 나고 column/user_id 관련 메시지면 `.eq("id", user.id)`로 재시도  
  3) `user_id`로 0건이면 `.eq("id", user.id)`로 한 번 더 update.
- **에러 시**: `console.error` + `NextResponse.json({ error: message }, 500)`.

```ts
// payload (DB 컬럼명 + updated_at)
const now = new Date().toISOString()
const payload: ProfileUpdate = {
  display_name: displayName,
  bio: bio !== undefined ? bio : (existing?.bio ?? null),
  avatar_url: avatarUrl !== undefined ? avatarUrl : (existing?.avatar_url ?? null),
  updated_at: now,
}

// 1) update by user_id
let { data: updated, error: updateError } = await supabaseAdmin
  .from("profiles")
  .update(payload)
  .eq("user_id", user.id)
  .select("user_id, display_name, bio, avatar_url, updated_at")
  .maybeSingle()

if (updateError) {
  if (msg.includes("user_id") || msg.includes("column") || msg.includes("does not exist")) {
    // 2a) fallback: update by id
    const { error: idError } = await supabaseAdmin.from("profiles").update(payload).eq("id", user.id)...
  } else {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }
} else if (!updated) {
  // 2b) 0 rows by user_id — try by id
  const { error: idError } = await supabaseAdmin.from("profiles").update(payload).eq("id", user.id)...
}
return NextResponse.json({ ok: true })
```

### 2-2. `app/me/page.tsx`

- **body**: `displayName`을 항상 non-empty로 전송 (`displayName?.trim() || user.name || "User"`).
- **실패 시**: `console.error("profile save failed", status, resData)` + `toast.error(msg)` + `throw new Error(msg)` → `finally`에서 `setSaving(false)`로 무한 로딩 방지.

```ts
const body = {
  displayName: (displayName?.trim() && displayName.trim()) || user.name || "User",
  bio: bio?.trim() || null,
}
if (avatar_url !== undefined) body.avatar_url = avatar_url

const profileRes = await fetch("/api/auth/profile", ...)
const resData = await profileRes.json().catch(() => ({}))
if (!profileRes.ok) {
  const msg = typeof resData?.error === "string" ? resData.error : "Failed to save profile"
  console.error("profile save failed", profileRes.status, resData)
  throw new Error(msg)
}
```

---

## 3) Supabase SQL 제안 (id vs user_id 정리)

현재 레포 스키마는 **user_id**가 PK입니다. Table Editor에서 **id**만 보인다면:

- **Case A**: `id`만 있고 `user_id`가 없음  
  → API는 이미 **id**로 update 시도하는 fallback을 넣었으므로, 그대로 두어도 동작해야 함.  
- **Case B**: `id`와 `user_id` 모두 있고, PK는 `id`  
  → `user_id`로 update하면 0 rows일 수 있음. 이 경우에도 **id** fallback으로 갱신됨.

**PK를 user_id로 통일하고 싶을 때** (선택):

```sql
-- 이미 id가 PK인 테이블을 user_id PK로 바꾸려면 (데이터 마이그레이션 필요)
-- 1) user_id 컬럼 추가 후 auth.users.id와 매칭
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.profiles SET user_id = id WHERE user_id IS NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_pkey,
  ADD PRIMARY KEY (user_id);
```

**현재 구조(id만 있음)를 유지**할 경우: 위 API 수정만으로 **id**로 update되므로 별도 ALTER 없이 사용 가능.

---

## 4) 검증 절차 결과

| # | 항목 | 확인 |
|---|------|------|
| 1 | /me → Edit Profile → display name "테스트123" → Save | ☐ |
| 2 | DevTools Network에서 profiles 관련 요청 200/201 | ☐ |
| 3 | Supabase Table Editor에서 해당 row의 display_name = "테스트123" | ☐ |
| 4 | /me 화면에 새로고침 없이 즉시 "테스트123" 반영 | ☐ |
| 5 | 기존 포스트/댓글/채팅에서 내 표시 이름도 "테스트123"으로 표시 | ☐ |

저장 실패 시: 콘솔에 `profile save failed` + status + resData, 토스트에 에러 메시지, 버튼은 "Saving…"에서 해제됨.
