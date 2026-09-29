# Step 7: ui-controls

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/UI_GUIDE.md` (색·컴포넌트 클래스·금지 패턴 — 반드시 따를 것)
- `/docs/ARCHITECTURE.md` (Dashboard만 상태 보유, 나머지는 표시용)
- `/src/types/*.ts`, `/src/lib/categories.ts` (step 1)
- `/src/lib/trendQuery.ts` (step 5 — `TrendQuery`, `MAX_QUERY_LENGTH`)
- `/src/lib/savedIdeas.ts` (step 6)
- `/vitest.config.mts`, `/vitest.setup.ts`, `/src/app/page.test.tsx` (step 0 — 컴포넌트 테스트 방식)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

검색 컨트롤, 요약 수치, 아이디어 카드, 저장 목록 컴포넌트를 만든다. 모두 **props만 받는 표시용 컴포넌트**이며 fetch·localStorage에 접근하지 않는다. 이벤트 핸들러를 받는 컴포넌트는 파일 첫 줄에 `'use client'`를 둔다.

### 1. `src/lib/format.ts` (순수)
```ts
export function formatCount(n: number): string;       // Intl ko-KR compact: 1234 → '1.2천', 15300 → '1.5만', 999 → '999'
export function formatPercent(ratio: number): string; // 0.0421 → '4.2%'
export function formatDuration(sec: number): string;  // 45 → '45초', 125 → '2분 5초'
export function formatMultiplier(x: number): string;  // 1.8 → '×1.8'
export function formatDate(iso: string): string;      // '2026-09-28T...' → '2026.09.28' (UTC 기준, 잘못된 값 → '-')
```
NaN·Infinity가 들어오면 `'-'`를 반환한다.

### 2. `src/components/SearchControls.tsx`
```ts
interface SearchControlsProps {
  initialQuery?: TrendQuery;                 // 기본: { kind: 'category', category: 'life-tips', days: 30 }
  loading: boolean;
  onSubmit: (query: TrendQuery) => void;
}
```
- 카테고리 버튼 3개(`CATEGORY_IDS` 순서, 라벨 표시, 선택 상태는 `aria-pressed`와 amber 강조)
- 직접 입력 텍스트 필드(placeholder `직접 키워드 입력 (선택)`, `maxLength=MAX_QUERY_LENGTH`)
- 기간 select(`DAYS_OPTIONS`, 라벨 `최근 7일` 등)
- `분석하기` 버튼(`loading`이면 disabled + 텍스트 `분석 중…`)
- 제출 규칙: 입력값이 trim 후 비어 있지 않으면 `{ kind: 'custom', q, days }`, 아니면 `{ kind: 'category', category, days }`. form submit(Enter)도 동작한다.

### 3. `src/components/SummaryStats.tsx`
```ts
interface SummaryStatsProps { summary: ReportSummary; query: string; days: Days }
```
- 제목: `"{query} · 최근 {days}일"`
- 수치 6칸: 분석한 쇼츠, 채널 수, 조회수 중앙값, 일평균 조회수 중앙값, 평균 참여율, 평균 길이. 각 칸은 라벨(보조 텍스트) + 수치(UI_GUIDE 수치 스타일, `tabular-nums`).

### 4. `src/components/IdeaCard.tsx`
```ts
interface IdeaCardProps { idea: ContentIdea; saved: boolean; onToggleSave: (idea: ContentIdea) => void }
```
- 표시: 키워드, 기회 지수(`formatMultiplier`, 1.5 이상이면 amber), 제목 후보 3개(번호 목록), 훅(`첫 3초:` 라벨), 근거 문장, 참고 영상 링크(`https://www.youtube.com/shorts/{id}`, `target="_blank" rel="noopener noreferrer"`)
- `fallback`이면 `기본 제안` 표시
- 저장 버튼: `aria-pressed={saved}`, 텍스트 `저장` / `저장됨`

### 5. `src/components/SavedIdeasPanel.tsx`
```ts
interface SavedIdeasPanelProps { ideas: SavedIdea[]; onRemove: (id: string) => void }
```
- 제목 `저장한 아이디어 ({n})`
- 항목마다 키워드, 첫 번째 제목, 저장일(`formatDate`), `삭제` 버튼(aria-label에 키워드 포함)
- 비어 있으면 `저장한 아이디어가 없습니다. 추천 카드에서 저장을 눌러 보세요.`

### 6. 테스트 (먼저 작성)
- `src/lib/format.test.ts` (node)
- `src/components/SearchControls.test.tsx`, `IdeaCard.test.tsx`, `SavedIdeasPanel.test.tsx`, `SummaryStats.test.tsx`
  - 각 파일 첫 줄 `// @vitest-environment jsdom`, `@testing-library/user-event` 사용
  - SearchControls: 카테고리 클릭 후 제출 → category 쿼리. 키워드 입력 후 Enter → custom 쿼리. 공백만 입력 → category 쿼리. loading일 때 버튼 disabled
  - IdeaCard: 제목 3개·훅·근거 표시, 참고 링크 href, fallback 표시, 저장 클릭 시 onToggleSave(idea), `saved`에 따라 aria-pressed
  - SavedIdeasPanel: 빈 상태 문구, 삭제 클릭 시 onRemove(id)
  - SummaryStats: 퍼센트·길이 포맷

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 컴포넌트가 `src/components/`에 있고 fetch·localStorage에 접근하지 않는가?
   - UI_GUIDE의 금지 패턴(blur, gradient text, glow, 보라/인디고, 모든 카드 rounded-2xl)을 쓰지 않았는가? (`grep -rnE "backdrop-blur|bg-clip-text|indigo|violet|purple|rounded-2xl" src/components` 결과 없음)
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (컴포넌트 이름과 props 요지 포함)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- UI 컴포넌트 라이브러리(shadcn/ui, MUI, Chakra 등)나 아이콘 패키지(lucide 등)를 추가하지 마라. 이유: UI_GUIDE와 의존성 최소화 원칙.
- 이 step에서 `src/app/page.tsx`를 수정하거나 Dashboard를 만들지 마라. 이유: step 9의 범위다.
- 컴포넌트 안에서 `fetch`나 `localStorage`를 호출하지 마라. 이유: 상태·부수효과는 Dashboard 한 곳에 모은다(ARCHITECTURE 패턴).
- 기존 테스트를 깨뜨리지 마라
