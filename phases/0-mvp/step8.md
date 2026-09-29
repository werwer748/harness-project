# Step 8: ui-tables

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/UI_GUIDE.md` (표·카드 스타일, 금지 패턴)
- `/docs/ARCHITECTURE.md`
- `/src/types/report.ts`, `/src/types/video.ts` (step 1)
- `/src/lib/format.ts` (step 7 — 숫자 포맷은 반드시 이것을 재사용)
- `/src/components/IdeaCard.tsx`, `/src/components/IdeaCard.test.tsx` (step 7 — 스타일·테스트 방식 참고)
- `/next.config.ts` (step 0)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

분석 결과 표 3종을 만든다. 모두 props만 받는 표시용 컴포넌트다. 이벤트가 없으면 `'use client'`를 붙이지 않는다.

### 1. `src/components/KeywordTable.tsx`
```ts
interface KeywordTableProps { keywords: KeywordStat[] }
```
- 제목 `뜨는 키워드`
- 열: 키워드 | 영상 수 | 채널 수 | 일평균 조회수(중앙값) | 평균 참여율 | 기회 지수
- 기회 지수는 1.5 이상이면 amber, 1 미만이면 neutral-500
- 빈 배열이면 `2개 이상 채널에서 반복된 키워드가 아직 없습니다.`

### 2. `src/components/PatternStats.tsx`
```ts
interface PatternStatsProps { titlePatterns: TitlePatternStat[]; durationBuckets: DurationBucketStat[] }
```
- 두 블록: `제목 패턴`(라벨, 비중 %, 일평균 조회수 중앙값, lift `×1.3`)과 `영상 길이`(구간 라벨, 비중, 중앙값)
- 비중은 `div` 너비(%)로 그린 가로 막대로 표시한다. 색은 neutral-700, 가장 높은 lift 행만 amber. 차트 라이브러리는 쓰지 않는다.

### 3. `src/components/TopVideosTable.tsx`
```ts
interface TopVideosTableProps { videos: ScoredVideo[] }
```
- 제목 `잘 되는 쇼츠 TOP {n}`
- 열: 썸네일(세로 9:16 비율 작은 이미지, `next/image`, `alt`=제목) | 제목(링크 `https://www.youtube.com/shorts/{id}`, `target="_blank" rel="noopener noreferrer"`) + 채널명 | 조회수 | 일평균 조회수 | 참여율 | 길이 | 게시일
- `thumbnailUrl`이 비어 있으면 썸네일 자리에 회색 박스를 둔다
- 빈 배열이면 `조건에 맞는 쇼츠가 없습니다.`

### 4. `next.config.ts`
- `images.remotePatterns`에 `{ protocol: 'https', hostname: 'i.ytimg.com' }`를 추가한다 (기존 설정 유지).

### 5. 테스트 (먼저 작성)
- `KeywordTable.test.tsx`, `PatternStats.test.tsx`, `TopVideosTable.test.tsx` (첫 줄 `// @vitest-environment jsdom`)
  - 행 수, 포맷된 수치, 빈 상태 문구
  - 기회 지수 강조 조건 (className 또는 data 속성으로 검증)
  - TopVideosTable 링크 href·target·rel, 썸네일 없음 처리
- `next/image`가 jsdom에서 문제를 일으키면 테스트 파일에서 `vi.mock('next/image', ...)`로 단순 `<img>`로 대체해도 된다.

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
   - UI_GUIDE 금지 패턴을 쓰지 않았는가? (`grep -rnE "backdrop-blur|bg-clip-text|indigo|violet|purple|rounded-2xl" src/components` 결과 없음)
   - 숫자 포맷을 `src/lib/format.ts`로만 했는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (컴포넌트 이름과 props 포함)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 차트 라이브러리(recharts, chart.js 등)를 추가하지 마라. 이유: 막대 몇 개면 되고 의존성 최소화 원칙.
- 썸네일에 `unoptimized` 없이 `i.ytimg.com` 외 도메인을 쓰지 마라. 이유: remotePatterns에 없는 호스트는 런타임 에러가 난다.
- `src/app/page.tsx`를 수정하지 마라. 이유: step 9의 범위다.
- 기존 테스트를 깨뜨리지 마라
