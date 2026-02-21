# Supabase 설정 방법 (TePal News)

로그인/회원가입과 포스트 저장을 위해 Supabase를 설정하는 방법입니다.

---

## 0. 연결이 안 될 때 (연결 확인)

1. **환경 변수 파일 위치**: `te-pal-news-ui` 폴더 안에 **`.env.local`** 파일이 있어야 합니다. (프로젝트 루트가 아니라 `te-pal-news-ui` 안)
2. **필수 변수 3개**가 들어 있어야 합니다:
   - `NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`
   - `SUPABASE_SERVICE_ROLE_KEY=eyJ...`
3. **저장 후 반드시 개발 서버 재시작**: 터미널에서 `Ctrl+C`로 서버를 멈춘 뒤 다시 `npm run dev` 실행.
4. **연결 상태 확인**: 브라우저에서 **http://localhost:3000/api/supabase-status** 를 열어 보세요.
   - `{"ok":true,"message":"Database connected"}` → 정상 연결
   - `{"ok":false,"missing":[...]}` → `.env.local`에 누락된 변수 이름이 표시됨. 해당 변수를 추가하고 서버를 다시 실행하세요.

---

## 1. Supabase 계정 및 프로젝트 만들기

1. **가입**: [https://supabase.com](https://supabase.com) 접속 후 **Start your project** → GitHub 또는 이메일로 가입/로그인
2. **New Project** 클릭
3. **Organization** 선택 (없으면 새로 생성)
4. **Project name**: 예) `tepal-news`
5. **Database Password**: 강한 비밀번호 입력 후 기억해 두기 (복구용)
6. **Region**: 가까운 지역 선택 (예: Northeast Asia - Seoul)
7. **Create new project** 클릭 → 프로젝트 생성 완료될 때까지 1~2분 대기

---

## 2. API 키 복사하기

1. 왼쪽 메뉴 **Settings** (톱니바퀴) 클릭
2. **API** 메뉴 선택
3. 아래 값 복사:
   - **Project URL** → `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API keys** 섹션:
     - **anon public** (공개 키) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - **service_role** (비공개, **Reveal** 클릭 후 복사) → `SUPABASE_SERVICE_ROLE_KEY`

---

## 3. 테이블 생성 (SQL 실행)

1. 왼쪽 메뉴 **SQL Editor** 클릭
2. **New query** 클릭
3. **`supabase-schema-v1.sql`** 파일 내용 전체 복사
4. SQL Editor에 붙여넣기
5. **Run** (또는 Ctrl+Enter) 실행
6. "Success. No rows returned" 또는 테이블 생성 메시지 확인

이렇게 하면 Schema v1이 적용됩니다: **profiles**(user_id, display_name, avatar_url), **posts**(author_id, type enum, post_media, comments, post_likes), **posts_feed** 뷰 등.

---

## 4. 이메일 인증 설정 (선택)

바로 로그인 가능하게 하려면:

1. **Authentication** → **Providers** → **Email** 선택
2. **Confirm email** 끄기 (OFF)
3. **Save** 클릭

켜 두면 가입 후 이메일 인증 링크를 눌러야 로그인할 수 있습니다.

---

## 5. 환경 변수 설정

### 로컬 개발

**반드시 `te-pal-news-ui` 폴더 안에** **`.env.local`** 파일을 만들고 아래처럼 넣습니다. (루트가 아님)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

- `https://xxxxxxxxxxxx.supabase.co` → 대시보드 **Settings → API**의 **Project URL**
- `eyJ...` (anon) → **anon public** 키
- `eyJ...` (service_role) → **service_role** 키

**저장 후 반드시 개발 서버를 다시 실행하세요.** (환경 변수는 서버 시작 시에만 읽습니다.)

```bash
cd te-pal-news-ui
npm run dev
```

### Vercel 배포

1. [Vercel](https://vercel.com) → 해당 프로젝트 선택
2. **Settings** → **Environment Variables**
3. 위 세 변수 각각 **Add**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. **Redeploy** 한 번 실행

### Admin 권한으로 포스팅하기 (선택)

로그인 화면의 **Admin 권한으로 접속**으로 들어온 뒤 글을 쓰려면:

1. Supabase **Authentication** → **Users**에서 관리용 계정 하나 생성 (또는 기존 사용자 사용)
2. 해당 사용자의 **UUID** 복사
3. **SQL Editor**에서 해당 UUID로 `profiles` 행이 있는지 확인. 없으면:
   ```sql
   insert into public.profiles (user_id, display_name, role) values ('여기에-UUID', 'Admin', 'admin');
   ```
4. `.env.local` 및 Vercel 환경 변수에 `SUPABASE_ADMIN_UID=해당-UUID` 추가

---

## 요약 체크리스트

- [ ] Supabase 프로젝트 생성
- [ ] Settings → API에서 URL, anon key, service_role key 복사
- [ ] SQL Editor에서 `supabase-schema-v1.sql` 실행
- [ ] (선택) Authentication → Email에서 Confirm email 끄기
- [ ] `te-pal-news-ui/.env.local`에 세 환경 변수 추가
- [ ] `npm run dev` 다시 실행 후 로그인/회원가입 테스트

이후에는 로그인·회원가입과 포스트 저장이 정상 동작합니다.
