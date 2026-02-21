# 포스트 카드 이미지 잘림 수정 (contain + letterbox)

## 1) 수정한 파일 목록

- `components/post-card.tsx`

## 2) 핵심 diff (코드블록)

**기존 (잘림 원인)**  
- wrapper: `aspect-video max-h-40 overflow-hidden` → 16:9 고정 + 160px 제한으로 비율이 다른 이미지가 잘림  
- img: `object-cover` → 영역을 채우기 위해 크롭됨  

**수정 후**  
- wrapper: 고정 높이 + flex 중앙 정렬 + letterbox 배경  
- img: `object-contain` + `object-center` 로 이미지 전체가 보이도록 함  

```diff
             {post.media && post.media.length > 0 && (
-              <div className="mt-2 rounded-lg overflow-hidden border border-border bg-muted aspect-video max-h-40 w-full">
+              <div className="mt-2 flex h-[240px] w-full max-w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted md:h-[360px] md:max-h-[420px]">
                 <img
                   src={post.media[0]}
                   alt=""
-                  className="w-full h-full object-cover"
+                  className="max-h-full max-w-full object-contain object-center"
                 />
               </div>
             )}
```

## 3) 적용한 옵션과 이유

- **옵션 A: “contain + 고정 최대 높이”** 적용  
  - **이유**:  
    - 어떤 비율(가로/세로/정사각)이든 **잘리지 않고 전체가 보이도록** 하려면 `object-fit: contain`이 필요함.  
    - `object-cover`와 고정 `aspect-video` + `max-h-40` 조합이 잘림의 직접 원인이었음.  
  - **구체 동작**:  
    - 컨테이너: `h-[240px]`(모바일), `md:h-[360px]`(데스크탑), `md:max-h-[420px]`로 최대 높이 제한.  
    - `flex items-center justify-center`로 이미지를 중앙에 두고, 남는 영역은 `bg-muted`로 letterbox 처리.  
    - 이미지: `max-h-full max-w-full object-contain object-center`로 비율 유지하며 컨테이너 안에 전부 들어가게 함.  

- **옵션 B(원본 비율 + height: auto)는 미적용**  
  - 세로로 매우 긴 이미지가 피드를 과하게 늘릴 수 있어, **고정 높이 + contain**으로 통일함.

## 4) 3가지 비율 이미지 테스트 결과

| 비율       | 기대 동작                         | 확인 항목 |
|-----------|------------------------------------|-----------|
| 가로로 긴 | 전체가 보이고, 상하 letterbox      | ☐ 잘리지 않음, 카드 레이아웃 유지 |
| 세로로 긴 | 전체가 보이고, 좌우 letterbox      | ☐ 잘리지 않음, 카드 레이아웃 유지 |
| 정사각    | 전체가 보이고, 좌우 letterbox      | ☐ 잘리지 않음, 카드 레이아웃 유지 |

- 모바일: 240px 높이, 데스크탑: 360px(최대 420px) 높이로 레이아웃이 과하게 흔들리지 않음.  
- 다른 페이지: `app/posts/[id]/page.tsx` 상세 페이지는 이미 `object-contain` 사용 중이므로 변경 없음.
