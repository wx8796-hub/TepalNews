# Like + Comment → Supabase 실제 저장 및 UI 반영

## 0) 스키마 실측 (DDL 기준)

- **public.posts**: `id` (uuid PK)
- **public.post_likes**: `post_id`, `user_id`, `created_at`, **PK (post_id, user_id)**
- **public.comments**: `id`, `post_id`, `author_id`, `body`, `is_hidden`, `parent_comment_id`, `created_at`, `updated_at`

## 1) Root Cause (왜 기존엔 DB에 안 들어갔는지) + 증거

### Like (하트)
- **원인 1**: 피드의 **PostCard**에서 하트 클릭 시 **DB 호출 없음** — `onClick={(e) => e.preventDefault()}` 만 있어 링크 이동만 막고, `/api/posts/[id]/like` 를 호출하지 않음.  
  **증거**: `components/post-card.tsx` 76행 부근 `onClick={(e) => e.preventDefault()}`.
- **원인 2**: 피드 목록을 가져올 때 **liked 상태를 서버에서 채우지 않음** — `GET /api/posts` 가 Authorization 없이 호출되고, `mapRowToPost` 가 항상 `liked: false` 로 설정.  
  **증거**: `app/api/posts/route.ts` GET 에서 `liked` 미설정, `lib/posts-api.ts` `mapRowToPost` 에서 `liked: false` 고정.
- **포스트 상세** (`/posts/[id]`) 는 이미 `toggleLike` 에서 `/api/posts/[id]/like` 를 호출하고 있어, 상세 페이지에서는 DB 반영 가능. 문제는 **피드 카드**와 **피드 목록의 liked 표시**.

### Comment (댓글)
- **원인**: 댓글은 이미 **DB insert + UI 반영** 구조가 있음. `POST /api/posts/[id]/comments` 가 `getRequestUserIdFromBody` 로 유저를 쓰고, `comments` 테이블에 `post_id`, `author_id`, `body` 로 insert. 클라이언트는 전송 후 응답을 리스트에 append.  
- **확인 사항**: 요청 시 **Authorization: Bearer** 가 꼭 포함되어야 함. 상세 페이지는 `authHeaders()` 로 헤더를 붙여 호출하므로, 로그인 상태에서는 DB에 저장됨.

## 2) 수정한 파일 목록 + 핵심 diff

### 2-1. `app/api/posts/route.ts` (GET 피드에 liked 반영)

- `GET` 에 `request` 인자 추가.
- `getRequestUserId(request)` 로 토큰이 있으면 `userId` 획득.
- `userId` 가 있으면 `post_likes` 에서 해당 유저의 `post_id` 목록 조회 후, 각 `Post` 에 `liked` 설정.

```ts
// GET(request: Request)
const auth = await getRequestUserId(request)
if (!("error" in auth) && auth.userId && posts.length > 0) {
  const postIds = posts.map((p) => p.id)
  const { data: likeRows } = await supabaseAdmin
    .from("post_likes")
    .select("post_id")
    .eq("user_id", auth.userId)
    .in("post_id", postIds)
  const likedSet = new Set((likeRows ?? []).map((r) => r.post_id))
  posts.forEach((p) => { p.liked = likedSet.has(p.id) })
}
return NextResponse.json(posts)
```

### 2-2. `lib/posts-context.tsx` (refetch 시 토큰 전달)

- `refetch(token?: string | null)` 로 시그니처 변경.
- `token` 이 있으면 `Authorization: Bearer ${token}` 헤더를 붙여 `GET /api/posts` 호출 → 서버가 `liked` 를 채워서 반환.

```ts
refetch: (token?: string | null) => Promise<void>

const refetch = useCallback(async (token?: string | null) => {
  const headers: HeadersInit = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch("/api/posts", { headers })
  // ...
}, [])
```

### 2-3. `components/post-card.tsx` (하트 클릭 시 API 호출 + refetch)

- `useAuth()`, `usePosts()`, `useRouter()` 사용.
- 하트 버튼: `onClick={handleLikeClick}`, `e.preventDefault()` / `e.stopPropagation()`.
- `handleLikeClick`: 비로그인 시 토스트 + `/auth` 이동; 로그인 시 `POST /api/posts/[id]/like` 에 `{ liked: !post.liked }` + `Authorization: Bearer` 전송.
- 성공 시 `refetch(token)` 호출해 피드(및 liked) 갱신; 실패 시 `toast.error` + `console.error`.

```ts
const handleLikeClick = async (e: React.MouseEvent) => {
  e.preventDefault(); e.stopPropagation()
  if (!user) { toast.error("Please sign in to like"); router.push("/auth"); return }
  const token = await getAccessToken()
  const res = await fetch(`/api/posts/${post.id}/like`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ liked: !post.liked }),
  })
  if (!res.ok) { toast.error(...); return }
  await refetch(token)
}
```

### 2-4. `app/page.tsx` (로그인 후 피드 재요청으로 liked 반영)

- `useAuth()` 의 `user`, `getAccessToken` 사용.
- `user` 가 있을 때 한 번 `getAccessToken().then((token) => refetch(token ?? undefined))` 호출해, 피드 목록을 Authorization 과 함께 다시 받아 `liked` 가 채워지도록 함.

```ts
useEffect(() => {
  if (!user) return
  getAccessToken().then((token) => refetch(token ?? undefined))
}, [user?.id, getAccessToken, refetch])
```

### 댓글 (comments)

- **수정 없음.**  
  `app/posts/[id]/page.tsx` 의 `sendComment` 가 이미 `POST /api/posts/[id]/comments` 를 `authHeaders()` 로 호출하고, 성공 시 응답을 `setComments` 로 append.  
  API 는 `post_id`, `author_id`, `body` 로 insert 하고, 컬럼명은 DDL 과 일치.

## 3) 검증 절차 (1~4)

| # | 항목 | 확인 |
|---|------|------|
| 1 | 로그인 후 피드에서 하트 클릭 → Network 에 `post_likes` 관련 요청(POST /api/posts/.../like) 발생, Table Editor 에 row 생성, UI 에 하트 활성 + count 증가 | ☐ |
| 2 | 다시 하트 클릭 → delete 요청, Table Editor 에서 row 삭제, UI count 감소 | ☐ |
| 3 | 댓글 입력 후 전송 → comments insert 요청, Table Editor 에 row 생성, 화면에 즉시 댓글 표시 + Comments(n) 증가 | ☐ |
| 4 | 새로고침 후에도 like/comment 가 DB 기준으로 동일하게 표시 | ☐ |

- **공통**: 실패 시 `console.error` + `toast.error` 로 메시지 노출, 로딩/상태 롤백.
