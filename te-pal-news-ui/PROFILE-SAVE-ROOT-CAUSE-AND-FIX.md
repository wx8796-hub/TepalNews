# Edit Profile Save → Supabase profiles 미반영 수정 (Root Cause + 검증)

## 1) Root Cause 1~3 + 증거

### Root Cause 1: DB 요청이 “어떤 식별 컬럼”으로 가는지에 따라 0 rows update 가능
- **증거**: API가 `eq('user_id', user.id)`만 쓰고, Table Editor 기준으로는 **id**가 첫 컬럼(또는 유일 식별자)인 구조일 수 있음. Supabase 대시보드에서 만든 테이블은 흔히 `profiles.id uuid PK references auth.users(id)` 형태.
- **결과**: `user_id`로 update 시 해당 컬럼이 없거나, PK가 `id`인데 `user_id`로만 조회하면 0 rows가 되어 DB가 안 바뀜. UI는 클라이언트 state만 바꿔서 “바뀐 것처럼” 보일 수 있음.

### Root Cause 2: Network에 DB 요청이 나가더라도 “조건 불일치”로 0 rows
- **증거**: 클라이언트는 `POST /api/auth/profile`을 호출함 (DevTools Network에서 확인 가능). API는 `supabaseAdmin.from('profiles').update(...).eq('user_id', user.id)` 호출. 서버 쪽에서 Supabase로는 요청이 나가지만, **eq 조건에 맞는 row가 없으면** update 결과 0 rows → Table Editor 값은 그대로.
- **확인 방법**: 터미널(서버 로그)에 `[profile] update by id ok, rows: 테스트123` 또는 `[profile] update by user_id failed` 등이 찍히는지로 실제로 어떤 경로로 갔는지 확인.

### Root Cause 3: profiles에 식별 컬럼(id 또는 user_id)이 없거나 이름이 다름
- **증거**: Table Editor에 role, display_name, bio, avatar_url, created_at, updated_at만 보이고 **id / user_id가 가로 스크롤이나 Definition 탭에만 있는 경우**. 또는 아예 없이 만든 경우.
- **결과**: `eq('id', user.id)` / `eq('user_id', user.id)` 둘 다 실패하거나 0 rows → DB 미반영. 이 경우 스키마 마이그레이션 필요.

---

## 2) 수정한 파일 목록 + 핵심 diff

### 2-1. `app/api/auth/profile/route.ts`

- **id 우선**: `profiles.id = auth.users.id` 가정하고 먼저 `.update(payload).eq('id', user.id)` 실행.
- **user_id 폴백**: `id` 관련 에러(컬럼 없음 등) 또는 0 rows면 `.eq('user_id', user.id)`로 update 시도.
- **upsert 폴백**: id/user_id 둘 다로 0 rows면 `upsert({ id, ...payload }, { onConflict: 'id' })` 또는 `onConflict: 'user_id'` 시도.
- **로깅**: `[profile] updating for user`, `[profile] update by id ok`, `[profile] update by user_id failed` 등 서버 로그로 경로 확인 가능.
- **에러**: 모든 실패 경로에서 `console.error` + `NextResponse.json({ error }, 500)` 반환.

```ts
// 1) Update by id first
let { data: updated, error: updateError } = await supabaseAdmin
  .from("profiles")
  .update(payload)
  .eq("id", user.id)
  .select("id, display_name, bio, avatar_url, updated_at")
  .maybeSingle()

if (updateError) {
  if (msg.includes("id") || msg.includes("column") || ...) {
    // fallback: update by user_id
    const res = await supabaseAdmin.from("profiles").update(payload).eq("user_id", user.id)...
  } else return 500
}
if (!updated) {
  // 2) try user_id update, 3) then upsert by id or user_id
}
return NextResponse.json({ ok: true, updated })
```

### 2-2. `app/me/page.tsx`

- Save 클릭 시 `console.log("[profile] save clicked")`.
- 요청 직전 `console.log("[profile] sending POST /api/auth/profile", { displayName })`.
- 응답 후 `console.log("[profile] response", status, resData)`.
- 실패 시 `console.error("[profile] save failed", status, resData)` + `toast.error(msg)` + `return` (이후 `finally`에서 `setSaving(false)`).

---

## 3) Supabase SQL 마이그레이션 (실행 가능)

**파일**: `supabase-profiles-id-migration.sql`

**용도**: Table Editor에 `id` 컬럼이 없을 때, `user_id`가 있는 스키마에서 `id`를 추가하고 PK로 쓰도록 함.

**실행**: Supabase Dashboard → SQL Editor → 파일 내용 붙여넣기 → Run.

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    UPDATE public.profiles SET id = user_id WHERE user_id IS NOT NULL AND id IS NULL;
    ALTER TABLE public.profiles
      DROP CONSTRAINT IF EXISTS profiles_pkey,
      ADD PRIMARY KEY (id);
  END IF;
END $$;
```

**주의**: 현재 테이블에 `user_id`가 없고 `id`만 있거나, 둘 다 없다면 Definition 탭에서 컬럼 구성을 확인한 뒤 필요 시 수동으로 `id uuid PRIMARY KEY REFERENCES auth.users(id)` 추가.

---

## 4) 검증 절차

1. **Save 시 DB 요청 확인**
   - /me → Edit Profile → display name `테스트123` → Save changes.
   - DevTools → Network: `POST /api/auth/profile` 요청 존재, Status 200.
   - (선택) 서버 터미널에 `[profile] updating for user` / `[profile] update by id ok` 등 로그 확인.

2. **Supabase Table Editor**
   - `public.profiles`에서 해당 유저 row의 `display_name`이 `테스트123`으로 변경되었는지 확인.

3. **새로고침 후 유지**
   - 페이지 새로고침 후에도 /me와 피드·댓글 등에서 `테스트123`으로 표시되는지 확인.

4. **실패 시**
   - Network에서 4xx/5xx이면 응답 body의 `error` 메시지 확인.
   - 브라우저 콘솔에 `[profile] save failed` + status + resData.
   - 토스트에 에러 메시지, 버튼 로딩 해제(Saving… → Save changes).

이대로 적용 후에도 Table Editor에 반영이 없으면, Supabase Table Editor → profiles → Definition에서 **실제 PK/컬럼명(id vs user_id)** 을 확인하고, 서버 로그에 찍힌 `[profile] update by id ok` / `update by user_id failed` 메시지와 함께 원인을 좁히면 됨.
