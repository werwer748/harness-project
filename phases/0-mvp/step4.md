# Step 4: analysis-engine

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (CRITICAL: `src/lib/analysis/`는 순수 함수, `now`는 인자로)
- `/docs/PRD.md` (핵심 기능 2·3)
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (ADR-002)
- `/src/types/*.ts`, `/src/lib/categories.ts` (step 1)
- `/src/services/__fixtures__/videos-page.json` (step 2)
- `/src/lib/analysis/tokenize.ts` (step 3)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

`ShortVideo[]`를 받아 `TrendReport`를 만드는 순수 분석·추천 엔진을 만든다. 모든 파일은 `src/lib/analysis/` 아래.

### 1. `metrics.ts`
```ts
export function median(values: number[]): number;                    // 빈 배열 → 0
export function computeMetrics(video: ShortVideo, now: Date): VideoMetrics;
export function scoreVideos(videos: ShortVideo[], now: Date): ScoredVideo[];
```
- `ageDays = max((now - publishedAt) / 1일, 1)` (미래 날짜·잘못된 날짜도 1)
- `viewsPerDay = viewCount / ageDays`
- `engagementRate = (likeCount + commentCount) / max(viewCount, 1)`

### 2. `keywords.ts`
```ts
export interface KeywordOptions {
  excludedTerms: ReadonlySet<string>;
  globalMedianViewsPerDay: number;
  minVideos?: number;    // 기본 2
  minChannels?: number;  // 기본 2
  limit?: number;        // 기본 20
}
export function extractKeywordStats(videos: ScoredVideo[], options: KeywordOptions): KeywordStat[];
```
- vocabulary = 모든 영상의 제목+태그로 `buildVocabulary`. 영상마다 `extractVideoTerms`로 용어를 뽑는다. 영상 단위로 중복이 제거되므로, 키워드 하나는 영상당 한 번만 센다.
- **서로 다른 영상 `minVideos`개 이상, 서로 다른 채널 `minChannels`개 이상**인 키워드만 채택한다.
- `medianViewsPerDay`: 키워드 포함 영상들의 중앙값.
- `opportunity` (수축 추정, K = 3):
  `shrunk = (medianViewsPerDay × n + global × K) / (n + K)`
  `opportunity = global > 0 ? shrunk / global : 0` (소수 둘째 자리 반올림, n = videoCount)
- 정렬: opportunity 내림차순 → videoCount 내림차순 → keyword 오름차순(`<` 비교, `localeCompare` 금지). 상위 `limit`개.

### 3. `patterns.ts`
```ts
export function analyzeTitlePatterns(videos: ScoredVideo[]): TitlePatternStat[];      // 4개 패턴 항상 반환 (순서: number, question, howto, short-title)
export function analyzeDurationBuckets(videos: ScoredVideo[]): DurationBucketStat[];  // 4개 구간 항상 반환 (0-15, 16-30, 31-60, 61-180)
```
- 패턴 판정 (원본 제목 기준):
  - `number`: 숫자 포함
  - `question`: `?` 포함 또는 `까`·`나요`·`는가`로 끝남 (끝의 해시태그·공백 무시)
  - `howto`: `방법`, `하는 법`, `하는법`, `꿀팁`, `노하우` 포함
  - `short-title`: 해시태그를 뺀 제목이 20자 이하
- 한국어 라벨: `숫자 포함`, `질문형`, `방법·꿀팁형`, `20자 이하 짧은 제목`, 구간 라벨 `15초 이하`, `16–30초`, `31–60초`, `61초–3분`.
- `share = videoCount / 전체 수` (전체 0이면 0)
- `lift = 전체 중앙값 > 0 ? 해당 패턴 중앙값 / 전체 중앙값 : 0`

### 4. `recommend.ts`
```ts
export function stableHash(text: string): number;  // 결정적 비음수 정수 (예: FNV-1a 32bit)
export interface BuildIdeasInput {
  scope: ReportScope;
  keywords: KeywordStat[];         // 이미 정렬된 상태
  videos: ScoredVideo[];
  fallbackKeywords: string[];      // 카테고리면 시드 3개, custom이면 [q]
  count?: number;                  // 기본 5
}
export function buildIdeas(input: BuildIdeasInput): ContentIdea[];
```
- `getTemplateSet(scope)`로 템플릿을 얻는다. `h = stableHash(keyword)`
  - 제목 3개: `titleTemplates[(h + i) % len]` (i = 0,1,2)
  - 훅: `hookTemplates[h % len]`
  - `{keyword}`를 치환한다
- `id = \`${scope}:${keyword}:${첫 번째 제목 템플릿의 key}\`` — 인덱스·날짜·난수를 넣지 않는다.
- 상위 키워드부터 `count`개를 만든다.
  - `reason` 예: `"'아침루틴' 쇼츠 4개(채널 3곳)의 일평균 조회수가 전체 중앙값의 1.8배, 평균 참여율 4.2%"`
  - `referenceVideos`: 키워드 포함 영상 중 viewsPerDay 상위 3개
- 키워드가 `count`개보다 적으면 `fallbackKeywords`로 채운다 (이미 쓴 키워드는 건너뛴다).
  - `fallback: true`, `opportunity: 0`, reason `"수집된 데이터가 부족해 기본 주제로 제안합니다"`
  - `referenceVideos`: 전체 viewsPerDay 상위 3개
- 같은 입력이면 항상 같은 배열을 반환해야 한다.

### 5. `index.ts`
```ts
export interface AnalyzeOptions {
  scope: ReportScope; query: string; days: Days;
  excludedTerms: ReadonlySet<string>;
  fallbackKeywords: string[];
  now: Date;
}
export function analyzeShorts(videos: ShortVideo[], options: AnalyzeOptions): TrendReport;
```
- `scoreVideos` → summary → keywords → patterns → ideas를 합친다.
- `topVideos`: viewsPerDay 내림차순(동점 시 id 오름차순) 상위 20개.
- `generatedAt = now.toISOString()`
- **영상 0개**여도 예외 없이 리포트를 반환한다: summary 전부 0, keywords `[]`, 패턴·구간은 videoCount 0으로 4개씩, ideas는 fallback으로 채우고 referenceVideos `[]`.
- **리포트의 모든 숫자는 `Number.isFinite`여야 한다** (NaN·Infinity는 JSON에서 `null`이 된다).

### 6. 테스트 (먼저 작성)
파일: `metrics.test.ts`, `keywords.test.ts`, `patterns.test.ts`, `recommend.test.ts`, `index.test.ts` (모두 `src/lib/analysis/`)
- 작은 인라인 `ShortVideo` 팩토리로 경계값을 검증한다:
  - `median`의 짝수·홀수·빈 배열
  - ageDays 하한 1, viewCount 0일 때 참여율
  - 채널 1곳에만 나온 키워드 제외
  - 수축 공식 값
  - 동점 정렬
  - 패턴 판정 예시
  - fallback 채우기와 중복 방지
- `index.test.ts`:
  - step 2 fixture(`videos-page.json`)를 `ShortVideo`로 변환해 `now = new Date('2026-09-29T00:00:00Z')`로 분석한다. 변환은 테스트 안의 헬퍼로 하거나, step 2에 export된 매퍼가 있으면 재사용한다.
  - 같은 입력을 두 번 넣으면 결과가 `toEqual`로 같다
  - 모든 숫자 필드가 finite다 (재귀 검사 헬퍼)
  - 영상 0개 입력이 위 규칙대로 나온다

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
grep -rnE "Date\.now\(|new Date\(\)|process\.env|fetch\(" src/lib/analysis --include=*.ts --exclude=*.test.ts || echo "OK: pure"
```
마지막 커맨드는 `OK: pure`만 출력해야 한다.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙(순수 함수)을 위반하지 않았는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (`analyzeShorts` 시그니처와 AnalyzeOptions 필드 포함)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `Math.random()`, `Date.now()`, 인자 없는 `new Date()`를 쓰지 마라. 이유: 결정성이 깨지고, localStorage 중복 제거용 아이디어 id가 매번 바뀐다.
- 키워드 성과에 평균(mean) viewsPerDay를 쓰지 마라. 이유: 바이럴 영상 하나가 결과를 지배한다. 중앙값과 수축 공식을 쓴다.
- `localeCompare`로 정렬하지 마라. 이유: ICU·환경에 따라 결과가 달라질 수 있다.
- `src/services/`나 YouTube API를 import하지 마라. 이유: 분석 레이어는 네트워크와 분리된 순수 계층이다(타입만 `@/types`에서 import).
- 기존 테스트를 깨뜨리지 마라
