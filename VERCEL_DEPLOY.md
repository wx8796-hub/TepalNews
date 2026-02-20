# Vercel 배포 시 Root Directory 설정

Next.js 앱이 **`te-pal-news-ui`** 폴더 안에 있으므로, Vercel에서 반드시 Root Directory를 지정해야 합니다.

## 방법 1: Vercel 대시보드에서 설정 (권장)

1. [Vercel 대시보드](https://vercel.com/dashboard) 접속
2. **TepalNews** 프로젝트 클릭
3. 위쪽 메뉴에서 **Settings** 클릭
4. 왼쪽 메뉴에서 **"Build and Deployment"** 또는 **"Build & Development"** 클릭  
   (General이 아님!)
5. 아래로 스크롤해서 **"Root Directory"** 항목 찾기
6. **Edit** 클릭 후 `te-pal-news-ui` 입력
7. **Save** 클릭
8. **Deployments** 탭에서 **Redeploy** 한 번 실행

---

## 방법 2: 프로젝트를 처음 연결할 때

새로 Import할 경우:

1. **Add New Project** → GitHub에서 **TepalNews** 선택
2. **Configure Project** 화면에서 **"Root Directory"** 옆 **Edit** 클릭
3. `te-pal-news-ui` 입력 후 **Continue** → **Deploy**

---

## Root Directory가 안 보일 때

- **General** 안에는 없습니다. **Build and Deployment** (또는 Build & Development) 메뉴를 열어야 합니다.
- 왼쪽 설정 메뉴를 끝까지 스크롤해보세요.
- Vercel UI가 바뀌었을 수 있으므로, **Settings** 아래에서 **빌드/배포 관련** 메뉴를 모두 확인해 보세요.
