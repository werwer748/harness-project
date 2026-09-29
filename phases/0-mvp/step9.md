# Step 9: dashboard-page

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md` (데이터 흐름·상태 관리)
- `/docs/UI_GUIDE.md` (레이아웃)
- `/src/types/*.ts` (step 1)
- `/src/lib/trendQuery.ts`, `/src/app/api/trends/route.ts` (step 5 — 요청 규약, 에러 body 형태)
- `/src/lib/savedIdeas.ts` (step 6)
- `/src/components/*.tsx` (step 7·8 — 컴포넌트 props)
- `/src/app/page.tsx`, `/src/app/page.test.tsx`, `/src/app/layout.tsx` (step 0)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

컴포넌트들을 하나의 대시보드로 연결한다.

### 1. `src/components/Dashboard.tsx` (`'use client'`, 앱에서 유일하게 상태를 가진 컴포넌트)
```ts
export default function Dashboard();   // 반환 타입은 추론에 맡긴다 (React 19 타입에는 전역 JSX 네임스페이스가 없다)
```
상태:
- `report: TrendReport | null`
- `loading: boolean`
- `error: ApiErrorBody['error'] | null`
- `savedIdeas: SavedIdea[]`

동작:
- **마운트 시 자동 검색을 하지 않는다** (쿼터 절약). 처음에는 안내 문구 `카테고리를 고르고 분석하기를 누르세요.`를 보여준다.
- `SearchControls.onSubmit(query)`
  - `fetch('/api/trends?' + toTrendSearchParams(query))` 호출
  - `res.ok`면 리포트를 설정한다
  - 아니면 body의 `error`를 설정한다. JSON 파싱에 실패하면 `{ code: 'INTERNAL_ERROR', message: '요청을 처리하지 못했습니다' }`
  - 네트워크 예외도 에러로 처리한다
- **경쟁 상태 방지**: 새 요청을 시작하면 이전 요청의 응답은 무시한다 (AbortController 또는 요청 번호 비교).
- 에러 표시: 에러 색(red)의 박스에 message를 보여준다. code가 `MISSING_API_KEY`면 `.env.example`을 복사해 `.env.local`에 키를 넣고 서버를 재시작하라는 안내를 한 줄 덧붙인다.
- 로딩 중에는 결과 영역을 `animate-pulse` 스켈레톤으로 표시한다.
- 리포트가 있으면 아래 순서로 렌더한다:
  - `SummaryStats`
  - `다음 콘텐츠 추천` 섹션 (`IdeaCard` 그리드)
  - `KeywordTable`
  - `PatternStats`
  - `TopVideosTable`
- `summary.videoCount === 0`이면 표 대신 `조건에 맞는 쇼츠가 없습니다. 기간을 늘리거나 다른 키워드를 시도하세요.` (fallback 아이디어 카드는 계속 보여준다)
- **저장**
  - `useEffect`에서만 `loadSavedIdeas()`를 호출한다 (서버 렌더와 첫 클라이언트 렌더가 일치해야 hydration 오류가 없다)
  - `onToggleSave`: 저장돼 있으면 `removeIdea(id)`, 아니면 `saveIdea(idea, new Date())`. 반환값으로 상태를 갱신한다
  - `SavedIdeasPanel`은 페이지 하단(또는 lg 이상에서 우측 열)에 둔다
- 레이아웃: UI_GUIDE (`max-w-6xl`, 좌측 정렬, 섹션 간 `space-y-8`)

### 2. `src/app/page.tsx` (Server Component 유지)
- 헤더(`Shorts Idea Lab` 제목 + 한 줄 설명 `생활 꿀팁 · 명언 · 자기객관화 쇼츠 트렌드를 분석하고 다음 콘텐츠를 추천합니다`) + `<Dashboard />`
- `'use client'`를 붙이지 않는다. 이유: `layout.tsx`의 metadata와 서버 렌더를 유지하기 위해서다.
- 기존 `src/app/page.test.tsx`가 계속 통과해야 한다 (필요하면 Dashboard를 mock하거나 heading 검증을 유지).

### 3. `README.md` (루트, 짧게)
- 한 줄 소개
- 실행 방법: `cp .env.example .env.local` → 키 입력 → `npm install` → `npm run dev`
- API 키 발급 요약: `.env.example` 주석 참고, HTTP 리퍼러 제한 금지
- 스크립트 목록, 쿼터 주의 (검색 1회당 search.list 최대 3회 호출, 같은 요청은 10분 캐시)

### 4. 테스트 (먼저 작성) — `src/components/Dashboard.test.tsx` (첫 줄 `// @vitest-environment jsdom`)
- `vi.stubGlobal('fetch', vi.fn())`으로 `/api/trends` 응답을 흉내 낸다. 리포트는 인라인으로 만들거나, step 4의 `analyzeShorts`에 step 2 fixture를 넣어 만든다.
- 매 테스트 전에 `localStorage.clear()`
- 테스트할 동작:
  - 초기에는 안내 문구가 보이고 fetch 호출 0회
  - 분석하기 → fetch URL에 `category=life-tips&days=30`이 들어가고, 결과에 아이디어 카드와 키워드 표가 렌더됨
  - 에러 응답(`MISSING_API_KEY`, 500) → 에러 message와 `.env.local` 안내 표시
  - 저장 클릭 → `localStorage`의 `shorts-idea-lab:saved-ideas:v1`에 기록되고 SavedIdeasPanel에 나타남. 다시 클릭하면 해제됨
  - 두 요청이 순서를 바꿔 응답해도 마지막 요청 결과만 표시됨

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음 (YOUTUBE_API_KEY 없이)
npm test        # 전체 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 상태·fetch·localStorage 접근이 `Dashboard.tsx`에만 있는가? (`grep -rn "fetch(\|localStorage" src/components`의 결과가 Dashboard와 테스트뿐인가)
   - `page.tsx`가 Server Component인가?
   - UI_GUIDE 금지 패턴을 쓰지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가? (클라이언트에서 YouTube 직접 호출 없음: `grep -rn "googleapis" src/components src/app/page.tsx` 결과 없음)
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단 (실제 키로 브라우저 확인을 하지 못하는 것은 blocked 사유가 아니다 — 사람이 따로 확인한다)

## 금지사항

- 클라이언트에서 `googleapis.com`을 직접 호출하지 마라. 이유: CLAUDE.md CRITICAL — 키가 브라우저에 노출된다.
- 렌더 중(컴포넌트 본문)에 `localStorage`를 읽지 마라. 이유: 서버 렌더와 결과가 달라 hydration 오류가 난다.
- 마운트 시 자동으로 `/api/trends`를 호출하지 마라. 이유: 페이지를 열 때마다 YouTube 쿼터를 소모한다.
- `next dev`를 띄워 실제 API로 검증하지 마라. 이유: `.env.local`에 키가 있으면 쿼터를 소모한다. 검증은 테스트로 한다.
- SWR, React Query 같은 데이터 패칭 라이브러리를 추가하지 마라. 이유: 요청이 하나뿐이고 의존성 최소화 원칙.
- 기존 테스트를 깨뜨리지 마라
