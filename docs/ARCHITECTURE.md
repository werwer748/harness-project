# 아키텍처

## 디렉토리 구조
```
src/
├── app/               # 페이지 + API 라우트 (page.tsx, api/trends/route.ts)
├── components/        # UI 컴포넌트 (Dashboard.tsx가 유일한 상태 보유 client 컴포넌트)
├── types/             # TypeScript 타입 정의
├── lib/               # 유틸리티 + 헬퍼 (categories.ts, duration.ts, savedIdeas.ts)
│   └── analysis/      # 순수 분석·추천 로직 (tokenize, metrics, keywords, patterns, recommend)
└── services/          # 외부 API 래퍼 (youtube.ts)
    └── __fixtures__/  # 테스트용 YouTube API 응답 JSON
```
테스트 파일은 대상 파일 옆에 `*.test.ts(x)`로 둔다.

## 패턴
- `app/page.tsx`는 얇은 Server Component이고, 화면 상태는 `components/Dashboard.tsx`(Client) 하나가 가진다. 나머지 컴포넌트는 props만 받는 표시용이다
- 외부 API 접근은 `services/youtube.ts` → `app/api/trends/route.ts` 경로로만 한다
- 분석은 `lib/analysis`의 순수 함수(`analyzeShorts(videos, options)`)로, `now`를 인자로 받는다

## 데이터 흐름
```
사용자 입력(카테고리 | 키워드, 기간)
 → Dashboard(Client) → fetch GET /api/trends?category=…|q=…&days=…
 → route.ts: 쿼리 검증 → services/youtube.fetchShorts (search.list → videos.list, 180초 이하 필터)
 → lib/analysis.analyzeShorts → TrendReport JSON
 → Dashboard → 요약·아이디어·키워드·패턴·영상 표 렌더
아이디어 저장: Dashboard → lib/savedIdeas → localStorage
```

## 상태 관리
- 서버 상태 없음 (DB 없음). YouTube 응답은 fetch `next.revalidate: 600`으로만 캐시
- 클라이언트 상태는 Dashboard의 useState(검색 조건, 리포트, 로딩, 에러, 저장 목록)
- localStorage는 `useEffect` 안에서만 읽는다 (hydration 불일치 방지)
