# Supabase DB Insert 수정 요약 (TePal News)

## 1) Root Cause 요약 (1~3개) + 증거

### RC1. 에러를 삼키고 UI에 노출하지 않음
- **증거**: `app/auth/page.tsx`에서 `profileErr` 시 `console.error`만 하고 `setError`/return 없음 → 사용자는 “왜 안 됐는지” 모름.
- **위치**: 회원가입 후 `profiles` insert 실패 시.

### RC2. 좋아요/댓글이 DB가 아닌 로컬 state만 변경
- **증거**: `app/posts/[id]/page.tsx`의 `toggleLike`/`sendComment`가 `setLiked`/`setComments`만 호출하고 Supabase/API 호출 없음. Network 탭에 `post_likes`/`comments` 요청 없음.
- **위치**: 포스트 상세 페이지 좋아요 버튼, 댓글 입력 후 전송.

### RC3. DB 미설정 시 GET /api/posts가 200 + [] 반환
- **증거**: `supabaseAdmin`이 null일 때 `NextResponse.json([])`만 반환 → 클라이언트는 “글이 없음”으로만 보이고, “DB 미설정” 오류를 알 수 없음. 콘솔에도 원인 노출 없음.
- **위치**: `app/api/posts/route.ts` GET.

---

## 2) 수정한 파일 목록 + 핵심 diff

### `lib/supabase-browser.ts`
- env 없을 때 `console.error`로 URL/anonKey 길이 로그.
- 개발 시 클라이언트 생성 시 URL 도메인 + anonKey 길이 1회 로그.

### `lib/supabase-server.ts`
- 개발 시 URL hostname, `SUPABASE_SERVICE_ROLE_KEY` 존재 여부(길이) 1회 로그 (키 값 출력 금지).

### `lib/api-auth.ts` (신규)
- `getRequestUserId(request)`: Authorization Bearer 또는 `X-User-Id: admin` → `userId` 반환.
- `getRequestUserIdFromBody(request, body)`: body 내 `userId: "admin"` 지원 (like/comment POST용).

### `app/auth/page.tsx`
- 회원가입 시 Profile API 실패 시 `setError(msg)` + `return` (진행 중단).
- 세션 없을 때 클라이언트 `profiles` insert 실패 시 `setError(profileErr.message)` + `return`. 에러를 삼키지 않음.

### `app/api/posts/route.ts`
- GET: `supabaseAdmin` 없으면 503 + `{ error: "Database not configured..." }` 반환 ([] 대신).
- POST: `post_media` insert 실패 시 500 + 에러 메시지 반환 (기존에는 console만).

### `app/api/posts/[id]/route.ts`
- **GET** 추가: 단일 포스트 조회 + `liked` 플래그 (Authorization 또는 `X-User-Id: admin` 있을 때만 `post_likes` 조회).

### `app/api/posts/[id]/like/route.ts` (신규)
- POST `{ liked: boolean, userId?: "admin" }`. Authorization 또는 body.userId로 사용자 식별.
- `liked === true` → `post_likes` insert, `false` → delete. `{ data, error }` 처리 후 error 시 500 + 메시지 반환.

### `app/api/posts/[id]/comments/route.ts` (신규)
- GET: 해당 post의 `comments` 목록 + profiles 조인해 author 노출.
- POST `{ body: string, userId?: "admin" }`: `comments` insert 후 `.select().single()`, error 시 500 + 메시지.

### `lib/auth-context.tsx`
- `getAccessToken(): Promise<string | null>` 추가 → API 호출 시 Bearer 토큰 전달용.

### `app/posts/[id]/page.tsx`
- 포스트 로드: `GET /api/posts/[id]` 호출 (Authorization 또는 `X-User-Id: admin`), 응답으로 `post` + `liked` 설정.
- 댓글 로드: `GET /api/posts/[id]/comments` 호출 후 `comments` state 설정.
- 좋아요: `POST /api/posts/[id]/like` 호출, 실패 시 롤백 + toast + console.error.
- 댓글 작성: `POST /api/posts/[id]/comments` 호출, 실패 시 toast + console.error, 성공 시 응답으로 댓글 목록 갱신.

### `app/posts/new/page.tsx`
- `addPost` catch에서 `console.error("addPost", e)` 추가.

### `app/api/auth/profile/route.ts`
- 기존대로 `upsertError` 시 500 + 메시지 반환 (변경 없음, 클라이언트에서 이제 이 에러를 setError로 표시).

---

## 3) 검증 절차

1. **Env**
   - `te-pal-news-ui/.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 설정.
   - 서버 재시작 후 콘솔에 `[Supabase server] URL domain: xxx`, `SUPABASE_SERVICE_ROLE_KEY length: n` 출력 확인.

2. **회원가입 → profiles**
   - 로그인 화면에서 Sign up (이메일/비밀번호/이름).
   - Network: `auth/v1/signup` 200, 이후 `POST /api/auth/profile` 200 (세션 있을 때) 또는 클라이언트에서 `rest/v1/profiles` insert.
   - Supabase Table Editor → `public.profiles`에 새 행 확인 (user_id, display_name, bio 등).

3. **로그인**
   - Log in 후 세션 확보. 이후 글쓰기/좋아요/댓글 시 Authorization 헤더에 토큰 전달되는지 Network에서 확인.

4. **Posting**
   - New Post로 글 작성 후 전송.
   - Network: `POST /api/posts` 201, body에 author.id (또는 Admin이면 서버에서 SUPABASE_ADMIN_UID 사용).
   - Table Editor → `public.posts`에 새 행 확인 (author_id, type, content 등).

5. **좋아요**
   - 포스트 상세에서 좋아요 버튼 클릭.
   - Network: `POST /api/posts/[id]/like` 200, body `{ liked: true }`.
   - Table Editor → `public.post_likes`에 (post_id, user_id) 행 확인. 다시 클릭 시 delete 후 행 삭제 확인.

6. **댓글**
   - 포스트 상세에서 댓글 입력 후 전송.
   - Network: `POST /api/posts/[id]/comments` 201.
   - Table Editor → `public.comments`에 새 행 확인 (post_id, author_id, body).

7. **에러 노출**
   - DB 끄거나 잘못된 env로 실행 후 회원가입/글쓰기/좋아요/댓글 시도 → toast 또는 화면에 에러 메시지, 콘솔에 로그 확인.

---

## 4) 재발 방지 체크리스트

- [ ] env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`(프론트), `SUPABASE_SERVICE_ROLE_KEY`(서버 전용, 번들에 포함 금지) 확인.
- [ ] 모든 Supabase 호출에서 `{ data, error }` 처리, `error` 시 로그 + 사용자에게 메시지(toast/ setError) 노출.
- [ ] insert/upsert/delete 후 `error`면 반드시 return/throw, “조용히 무시” 금지.
- [ ] payload: DDL(supabase-schema-v1.sql)의 컬럼명/타입/NOT NULL/default와 일치 (profiles: user_id, display_name; posts: author_id, type enum; post_likes: post_id, user_id; comments: post_id, author_id, body).
- [ ] 비밀번호는 auth.users만 사용, public 테이블에 저장하지 않음.
- [ ] service_role 키는 서버(API route)에서만 사용, 클라이언트 번들/환경 변수에 노출하지 않음.
