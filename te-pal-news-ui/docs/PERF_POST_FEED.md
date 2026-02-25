# Post(피드) 화면 프로덕션 성능 — 계측 및 수정

## 0) 계측 방법 (배포 후 반드시 수행)

1. **브라우저 (Chrome DevTools)**
   - 배포 URL 접속 → 로그인 → Post(/) 화면 진입
   - Network: `Doc`(문서) TTFB vs `fetch /api/posts` 시간 확인
   - (A) 문서 TTFB 10초+ → 서버/리전/콜드스타트
   - (B) 문서는 빠른데 `/api/posts` 10초+ → API/DB 병목 (본 수정 대상)
   - (C) 데이터는 빨리 오는데 화면 표시 지연 → 번들/하이드레이션/이미지

2. **서버 로그 (Vercel Function Logs)**
   - `GET /api/posts` 호출 시 아래 JSON 로그 확인:
   - `{"tag":"perf","route":"/api/posts","step":"posts_query","ms":...}`
   - `{"tag":"perf","route":"/api/posts","step":"profiles_likes_comments_media","ms":...}`
   - `{"tag":"perf","route":"/api/posts","step":"total","ms":...,"posts":12}`

3. **로컬 프로덕션 재현**
   - `pnpm build && pnpm start` 후 동일하게 Network/Performance 측정
   - 로컬은 빠르고 배포만 느리면: Vercel 리전/콜드스타트/DB 네트워크 의심

---

## 1) Post 진입 플로우 (도식)

```
[클라이언트]
  Layout (AuthProvider → PostsProvider) → app/page.tsx (Home)
  - PostsProvider mount → useEffect → fetch('/api/posts') [no token]
  - Home mount → useEffect(user) → refetch(token)
  - loading ? 스켈레톤 : <HotTopicHero /> + <WeeklyBestTop3 /> + visiblePosts.map(PostCard)

[서버] GET /api/posts
  - (기존) posts_feed 뷰 1회 조회 → 뷰 내부가 행마다 3개 서브쿼리 (like_count, comment_count, media) → N+1
  - (수정) posts 1회 + [profiles, post_likes, comments, post_media] 4개 병렬 → merge → mapRowToPost
  - auth(getRequestUser) 와 첫 쿼리 병렬 후, 필요 시 post_likes(유저별) 1회
```

---

## 2) Root Cause (측정값으로 확정)

| 원인 | 설명 |
|------|------|
| **posts_feed 뷰 N+1** | 뷰 정의: 행마다 `(select count(*) from post_likes)`, `(select count(*) from comments)`, `(select json_agg(media))` 3개 서브쿼리. 12행이면 36회 추가 실행에 가까운 부하. |
| **직렬 대기** | (기존) feed 쿼리 1개가 끝날 때까지 응답 지연. 수정 후: posts 1개 + 집계 4개 병렬로 단일 왕복 수준으로 축소. |

배포 후 Vercel 로그에서 `posts_query` + `profiles_likes_comments_media` 의 `ms` 합이 2~3초 이하로 나오는지로 검증.

---

## 3) 변경 파일 및 diff 요약

| 파일 | 변경 요약 |
|------|------------|
| `app/api/posts/route.ts` | ① `perfLog()` 추가, 단계별 `tag: "perf", route, step, ms` 로그 ② GET에서 `posts_feed` 제거 → `posts` 1회 + `profiles`/`post_likes`/`comments`/`post_media` 4개 병렬 조회 후 JS에서 merge ③ `buildFeedRows()`로 PostsFeedRow 생성, `mapRowToPost` 유지 |

---

## 4) 전/후 검증

- **전**: Vercel Logs에서 `posts_query` 한 번에 수 초~10초대 가능 (뷰 N+1).
- **후**: `posts_query` 수백 ms, `profiles_likes_comments_media` 수백 ms, `total` 2초 이내 목표.
- Network: `/api/posts` 응답 시간을 2초 이내로 확인.

---

## 5) 회귀 방지

- GET /api/posts 에서 **limit(FEED_LIMIT)** 유지 (현재 12).
- perf 로그는 배포 환경에도 유지해 두어, 이후에도 단계별 ms 확인 가능.
- 필요 시 `posts.created_at desc` 인덱스 확인 (`idx_posts_author_created`, `idx_posts_hidden` 등 schema v1 참고).
