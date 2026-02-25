# Post(피드) 화면 프로덕션 성능 — 원인 확정 및 수정

## 1) 원인 1~2개 (숫자로 확정)

| 구분 | 내용 |
|------|------|
| **(1) likes/comments “행 목록” 조회** | `/api/posts` GET에서 `post_likes`, `comments`를 `.select("post_id").in("post_id", postIds)`로 **전체 행**을 가져온 뒤 JS에서 count. 인기 포스트가 많으면 payload/DB 부담 증가. → **DB에서 group by 집계만** 반환하도록 RPC `get_feed(limit_n)`로 변경. |
| **(2) 중복 호출 + 캐시 미적용** | ① PostsProvider 마운트 시 `refetch()` 1회(무토큰) ② Home에서 user 생기면 `refetch(token)` 1회 → **동일 피드를 2번** 요청. ③ Authorization 헤더로 인해 응답이 사용자별로 달라져 **public 캐시**가 사실상 적용되지 않음. → **엔드포인트 분리**(public-posts 캐시 가능, me/likes 개인화) + **Provider 마운트 시 refetch 제거**, Home에서만 1회 호출. |

**확정 방법**: Network에서 `/api/posts` 또는 `/api/public-posts` duration, Vercel Logs에서 `tag:"perf"` step별 ms 확인.

---

## 2) 변경 파일 목록 + 핵심 diff

| 파일 | 변경 요약 |
|------|------------|
| **supabase-get-feed-rpc.sql** (신규) | `get_feed(limit_n)` RPC: CTE로 posts_page → likes_agg / comments_agg / media_agg **group by** 후 join. 행당 서브쿼리 없음. 인덱스: `idx_posts_feed_created`, `idx_post_likes_post_id`, `idx_comments_post_hidden`, `idx_post_media_post_id`. |
| **app/api/public-posts/route.ts** (신규) | GET: auth/cookies 없음. `supabaseAdmin.rpc("get_feed", { limit_n: 12 })` **1회** 호출. `Cache-Control: public, s-maxage=60, stale-while-revalidate=120`. perf 로그: `get_feed_rpc`, `total`. |
| **app/api/me/likes/route.ts** (신규) | GET: `postIds` 쿼리, auth 필수. `post_likes`에서 해당 user_id로 조회 후 `{ [postId]: true }` 반환. 작은 payload. |
| **app/api/posts/route.ts** | GET: 기존 5회 쿼리 제거 → **get_feed RPC 1회** + (auth 시) post_likes 1회. perf step: `get_feed_rpc`, `auth_likes`, `total`. |
| **lib/posts-context.tsx** | ① **Provider 마운트 시 `refetch()` 제거** (중복 호출 제거). ② `refetch(token?)`: 없으면 `/api/public-posts`만 호출; 있으면 먼저 public-posts(없을 때만) 후 `/api/me/likes` 호출해 `liked` 병합. `postIdsRef`로 id 목록 유지. |
| **app/page.tsx** | user 유무와 관계없이 **mount 시 1회** `refetch(token ?? undefined)` 호출 (비로그인: public-posts만, 로그인: public-posts + me/likes). |

---

## 3) 전/후 비교표 (ms)

| 항목 | 전 (목표 측정) | 후 (목표) |
|------|----------------|-----------|
| `/api/posts` 또는 `/api/public-posts` duration | 10초+ 또는 수 초대 | **2초 이내** |
| posts_query / get_feed_rpc step | 수 초 (행 목록 + JS count) | **수백 ms** (RPC 1회) |
| profiles_likes_comments_media step | 수 초 (제거됨) | — |
| total (함수 전체) | 10초+ | **2~3초 이내** |
| 피드 API 호출 횟수 (첫 진입) | 2회 (Provider + user 시 refetch) | **1회** (public-posts) + 필요 시 1회 (me/likes) |
| 첫 화면(스켈레톤/일부 포스트) | — | **2초 내** |
| 전체 피드 | — | **3초 내** |

배포 후 Vercel Function Logs에서 `tag:"perf"` 로그로 step별 ms를 측정해 위 표를 채우면 됨.

---

## 4) 회귀 방지

- **public 피드**: `/api/public-posts`는 auth/cookies 사용 금지, `Cache-Control` 및 `limit_n` 유지.
- **개인화**: 좋아요 여부는 `/api/me/likes`로만 처리, 피드 목록과 분리.
- **limit**: RPC 및 public-posts 모두 `limit_n=12` 유지.
- **perf 로그**: `get_feed_rpc`, `auth_likes`, `total` 등 step 로그 유지해 배포 후에도 병목 확인 가능.

---

## 배포 전 필수

**Supabase SQL Editor에서 `supabase-get-feed-rpc.sql` 실행** 후 배포.  
실행하지 않으면 `/api/public-posts` 및 GET `/api/posts`가 502와 함께 “Run supabase-get-feed-rpc.sql…” 메시지를 반환함.

---

## 2차: 캐시·페이로드·LCP (여전히 느릴 때)

### 원인 확정 (숫자)

- **x-vercel-cache**: 응답 헤더에서 `HIT`/`MISS` 확인. `MISS`가 많으면 캐시 미적용(Set-Cookie/Vary/Cookie 사용 여부 점검).
- **Server-Timing**: `/api/public-posts`에 `rpc;dur=…, map;dur=…, total;dur=…` 추가 → Network 탭에서 단계별 ms 확인.
- **LCP**: Performance 탭에서 LCP 리소스가 이미지인지 텍스트인지 확인. 이미지면 above-the-fold 1장만 priority.

### 적용한 수정

| 파일 | 변경 |
|------|------|
| **app/api/public-posts/route.ts** | ① **Server-Timing** 헤더 추가 (`rpc`, `map`, `total` ms). ② **Cache-Control**: `s-maxage=300, stale-while-revalidate=600`. ③ **Vary**: `Accept-Encoding`만 명시. ④ **목록 페이로드 축소**: `toListPost()`로 content 140자 truncate, media는 첫 1개만 반환. (cookies/headers 미호출 유지.) |
| **components/post-card.tsx** | ① **priorityImage** prop: 첫 카드만 `loading="eager"`, `fetchPriority="high"`. ② **sizes**: `(max-width: 768px) 100vw, 672px`. ③ **React.memo(PostCardInner)** 로 불필요 리렌더 감소. |
| **app/page.tsx** | 첫 번째 `PostCard`에 `priorityImage={true}` 전달. |

### 전후 비교 (배포 후 채울 것)

| 항목 | 전 | 후 |
|------|-----|-----|
| x-vercel-cache | MISS 다수 | **HIT** 확인, age 누적 |
| Server-Timing total (ms) | — | Network에서 확인 |
| content-length | — | 140자+첫 미디어 1개로 감소 |
| Lighthouse FCP/LCP/TBT | — | 모바일 기준 측정 |

### 회귀 방지

- 목록 응답은 **최소 payload**(content truncate, media 1개) 유지.
- `/api/public-posts`는 **cookies()/headers()/Authorization** 사용 금지.
- **Server-Timing** 및 perf 로그 유지.

---

## 3차: 첫 피드 서버 렌더 (8초 → 2초 목표)

### 병목 결론 (가정)

- **클라이언트 fetch 지연**: 홈이 전부 "use client"라서, HTML 도착 후 → JS 로드 → hydrate → PostsProvider mount → refetch() → **/api/public-posts 응답 후**에야 카드가 그려짐. API가 1초여도 “첫 카드까지” 5~8초가 나올 수 있음.
- **Doc TTFB**: 미들웨어 없음. 레이아웃은 서버 컴포넌트이지만 AuthProvider/PostsProvider가 클라이언트라, 문서 자체는 정적일 수 있음. 계측으로 확인.

### 적용한 수정 (1순위: 첫 피드를 서버에서)

| 파일 | 변경 |
|------|------|
| **lib/get-public-feed-server.ts** (신규) | 서버 전용. `unstable_cache(getPublicFeedUncached, ["public-feed"], { revalidate: 300 })`. cookies/headers 미사용, `get_feed(12)` RPC + 목록용 truncate. |
| **app/page.tsx** | **서버 컴포넌트**로 변경. `export const revalidate = 300`. `getPublicFeedServer()` 호출 후, `<script id="initial-posts" type="application/json">` + 인라인 스크립트로 `window.__INITIAL_POSTS__` 설정. `<HomePageClient />` 렌더. |
| **app/HomePageClient.tsx** (신규) | 기존 홈 UI(client). 스켈레톤은 `loading && !hasPosts`일 때만. `showContent = hasPosts \|\| !loading` → 서버에서 받은 초기 posts가 있으면 즉시 카드 표시. |
| **lib/posts-context.tsx** | `useState<Post[]>(() => getInitialPostsFromServer())`, `useState(loading)(() => getInitialPostsFromServer().length === 0)`. 서버에서 넣은 `window.__INITIAL_POSTS__`로 첫 페인트에 posts + loading=false. |

### 검증 방법 (프로덕션)

1. **첫 로드**: Network에서 **첫 요청에 /api/public-posts가 없어도** HTML에 피드 카드(텍스트/틀)가 포함되는지 확인. (서버가 직접 RPC 호출하므로 클라이언트는 초기 12개를 API로 다시 안 불러도 됨.)
2. **첫 카드까지 시간**: Performance 또는 Lighthouse로 “첫 카드(텍스트/틀)가 보이는 시점”이 Doc TTFB + 파싱 직후(2초 내)인지 확인.
3. **Doc TTFB**: 홈(/) 요청의 문서 TTFB. revalidate=300이면 두 번째 방문부터 캐시 가능.
