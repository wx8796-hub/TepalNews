# Edit Profile → Supabase 반영 및 일관된 작성자 표시 구현

## 1) Root Cause (근본 원인)

- **왜 반영이 안 됐는지**
  - `/me`(Profile)의 Edit Profile에서 "Save changes"를 눌렀을 때 **Supabase에 요청을 보내지 않았음**.
  - `handleSave`가 `toast.success("Profile updated!")`와 `setEditOpen(false)`만 수행하고, **`/api/auth/profile` 호출이 없었음**.
- **증거(코드 위치)**
  - `app/me/page.tsx` (기존):
    ```ts
    const handleSave = () => {
      toast.success("Profile updated!")
      setEditOpen(false)
    }
    ```
  - 아바타는 `FileReader.readAsDataURL`로 로컬 미리보기만 하고 `localStorage`에 저장했을 뿐, Supabase Storage 업로드 및 `profiles.avatar_url` 갱신 없음.
- **DB/UI 구조**
  - 스키마는 이미 단일 소스: `profiles`(user_id, display_name, bio, avatar_url), `posts`/`comments`/`messages`에는 author_id/sender_id만 있고 이름/아바타 중복 컬럼 없음.
  - 피드/댓글/채팅은 이미 `posts_feed` 뷰 또는 `profiles` 조회로 작성자 표시를 하고 있어, **프로필만 갱신되면** 과거 포스트/댓글/메시지도 새 이름·아바타로 보이도록 되어 있었음. 문제는 프로필 갱신 자체가 되지 않던 것.

---

## 2) 수정 파일 목록 + 핵심 diff

### 2-1. `lib/auth-context.tsx`
- **추가**: `refreshProfile: () => Promise<void>` — 현재 세션 사용자를 `profiles`에서 다시 조회해 `user` 상태 갱신.
- **추가**: `getAccessToken` 다음에 `refreshProfile` 구현; `value`에 `refreshProfile` 노출.

```ts
// type
refreshProfile: () => Promise<void>

// implementation
const refreshProfile = useCallback(async () => {
  if (!supabase || isDemo) return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return
  const u = await fetchProfile(session.user.id)
  if (u) setUser(u)
}, [fetchProfile, isDemo])
```

### 2-2. `app/api/auth/profile/route.ts`
- **변경**: 전송하지 않은 필드는 기존 값 유지(PATCH 동작). 기존 프로필을 조회한 뒤 `display_name`/`bio`/`avatar_url` 중 보낸 것만 반영.

```ts
const { data: existing } = await supabaseAdmin
  .from("profiles")
  .select("display_name, bio, avatar_url")
  .eq("user_id", user.id)
  .maybeSingle()

const displayName = name ?? existing?.display_name ?? (user.user_metadata?.name as string) ?? "User"
const row = {
  user_id: user.id,
  display_name: displayName,
  bio: bio !== undefined ? bio : (existing?.bio ?? null),
  avatar_url: avatarUrl !== undefined ? avatarUrl : (existing?.avatar_url ?? null),
}
```

### 2-3. `app/me/page.tsx`
- **변경**: `handleSave`에서
  1. `getAccessToken()`으로 토큰 확보
  2. 선택된 아바타 파일이 있으면 `POST /api/upload/avatar`로 업로드 후 응답 `url` 수신
  3. `POST /api/auth/profile`에 `displayName`, `bio`, (업로드 시) `avatar_url` 전송
  4. 성공 시 `refreshProfile()`, `refetchPosts()`, 토스트, 모달 닫기
- **추가**: 아바타 파일 선택 시 `pendingAvatarFileRef`에 `File` 보관해 Save 시 업로드.
- **추가**: `user` 변경 시 `displayName`/`bio`/`avatarUrl` 동기화(프로필 저장 후 즉시 반영).
- **추가**: 저장 중 `saving` 상태로 버튼 비활성화 및 "Saving…" 표시.

### 2-4. `app/api/upload/avatar/route.ts` (신규)
- **역할**: Bearer 토큰으로 사용자 검증 후, `file`(또는 `avatar`) 필드 이미지를 `avatars` 버킷에 `{user_id}/{timestamp}-{filename}` 경로로 업로드.
- **응답**: `{ url: publicUrl }` (Storage public URL).

### 2-5. `app/chat/page.tsx`
- **추가**: 현재 사용자(`appUser`)의 `id`/`name`/`avatar` 변경 시
  - `profilesCache`에 해당 사용자 프로필 갱신
  - 기존 메시지 중 `sender_id === appUser.id`인 항목의 `display_name`/`avatar_url` 갱신

```ts
useEffect(() => {
  if (!appUser) return
  const avatarUrl = typeof appUser.avatar === "string" && appUser.avatar.startsWith("http") ? appUser.avatar : null
  setProfilesCache((c) => ({ ...c, [appUser.id]: { user_id: appUser.id, display_name: appUser.name, avatar_url: avatarUrl } }))
  setMessages((prev) =>
    prev.map((m) =>
      m.sender_id === appUser.id ? { ...m, display_name: appUser.name, avatar_url: avatarUrl ?? m.avatar_url } : m
    )
  )
}, [appUser?.id, appUser?.name, appUser?.avatar])
```

---

## 3) Supabase SQL 마이그레이션

- **파일**: `supabase-avatars-bucket.sql`
- **내용**:
  - `storage.buckets`에 `avatars` 버킷 추가(public, 5MB, image/* 타입). `on conflict (id) do update`로 이미 있으면 설정만 갱신.
  - 정책: authenticated는 자신의 폴더(`auth.uid()`와 일치)에만 업로드, public은 avatars 버킷 읽기.

Edit Profile 아바타 업로드를 쓰려면 Supabase SQL Editor에서 이 파일을 실행하거나, Dashboard → Storage에서 `avatars` 버킷을 public으로 생성하면 됨.

---

## 4) 검증 결과 체크리스트

| # | 항목 | 확인 |
|---|------|------|
| 1 | 내 계정으로 Post 1개, Comment 1개, Chat message 1개 작성 | ☐ |
| 2 | `/me`에서 Display name과 Avatar 변경 후 Save | ☐ |
| 3 | 저장 직후: 내 과거 Post 작성자 표시가 새 이름/아바타로 변경 | ☐ |
| 4 | 저장 직후: 내 과거 Comment 작성자 표시가 새 이름/아바타로 변경 | ☐ |
| 5 | 저장 직후: 채팅 메시지 리스트에서 내 메시지 표시가 새 이름/아바타로 변경 | ☐ |
| 6 | 새로고침 후에도 동일하게 유지(Supabase profiles 반영) | ☐ |

- **Post/Comment 표시**: 이미 `posts_feed` 뷰와 comments API가 `profiles`를 참조하므로, 프로필 저장 후 `refreshProfile()` + `refetchPosts()`(및 필요 시 해당 포스트/댓글 재조회)로 즉시 반영됨.
- **Chat**: `appUser` 갱신 시 위 `useEffect`로 캐시와 메시지 표시가 동기화됨.
- **Presence**: 온라인 목록이 profiles 또는 `appUser` 기반이면, 프로필 저장 후 `refreshProfile()`만으로 동일하게 반영됨.
