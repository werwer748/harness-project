# Step 1: core-types

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/package.json`, `/tsconfig.json`, `/vitest.config.mts` (step 0 산출물)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

이후 모든 step이 공유하는 도메인 타입과 카테고리 설정을 만든다. 아래 이름과 필드는 **이후 step들이 그대로 참조하므로 바꾸지 마라**(필드 추가는 가능).

### 1. `src/types/category.ts`
```ts
export type CategoryId = 'life-tips' | 'quotes' | 'self-reflection';
export type ReportScope = CategoryId | 'custom';   // custom = 사용자가 직접 입력한 키워드
export type Days = 7 | 30 | 90;

export interface TitleTemplate { key: string; text: string }   // text에 '{keyword}' 포함
export interface TemplateSet {
  titleTemplates: TitleTemplate[];  // 6개 이상, key는 세트 안에서 고유
  hookTemplates: string[];          // 4개 이상, 각각 '{keyword}' 포함
}
export interface CategoryConfig extends TemplateSet {
  id: CategoryId;
  label: string;          // 화면 표시명
  description: string;    // 한 줄 설명
  seedKeywords: string[]; // 정확히 3개 (YouTube 검색어)
}
```

### 2. `src/types/video.ts`
```ts
export interface ShortVideo {
  id: string; title: string; description: string;
  channelId: string; channelTitle: string;
  publishedAt: string;      // ISO 8601
  thumbnailUrl: string;     // 없으면 ''
  tags: string[];
  durationSec: number;
  viewCount: number; likeCount: number; commentCount: number;
}
export interface VideoMetrics { ageDays: number; viewsPerDay: number; engagementRate: number }
export type ScoredVideo = ShortVideo & VideoMetrics;
```

### 3. `src/types/report.ts`
```ts
export interface KeywordStat {
  keyword: string;
  videoCount: number;          // 이 키워드가 등장한 서로 다른 영상 수
  channelCount: number;        // 그 영상들의 서로 다른 채널 수
  medianViewsPerDay: number;
  avgEngagementRate: number;   // 0~1
  opportunity: number;         // 1보다 크면 전체 대비 성과가 좋음
  videoIds: string[];
}
export type TitlePattern = 'number' | 'question' | 'howto' | 'short-title';
export interface TitlePatternStat { pattern: TitlePattern; label: string; videoCount: number; share: number; medianViewsPerDay: number; lift: number }
export type DurationBucket = '0-15' | '16-30' | '31-60' | '61-180';
export interface DurationBucketStat { bucket: DurationBucket; label: string; videoCount: number; share: number; medianViewsPerDay: number }
export interface ReferenceVideo { id: string; title: string; channelTitle: string; viewCount: number; viewsPerDay: number }
export interface ContentIdea {
  id: string;                  // `${scope}:${keyword}:${templateKey}` — 결정적
  scope: ReportScope;
  keyword: string;
  titles: string[];            // 3개
  hook: string;
  reason: string;              // 추천 근거 한국어 문장
  opportunity: number;
  referenceVideos: ReferenceVideo[];  // 최대 3개
  fallback: boolean;           // 데이터 부족으로 기본 주제에서 만든 아이디어면 true
}
export interface SavedIdea extends ContentIdea { savedAt: string }
export interface ReportSummary {
  videoCount: number; channelCount: number;
  medianViews: number; medianViewsPerDay: number;
  avgEngagementRate: number; avgDurationSec: number;
}
export interface TrendReport {
  scope: ReportScope; query: string; days: Days; generatedAt: string;
  summary: ReportSummary;
  ideas: ContentIdea[];
  keywords: KeywordStat[];
  titlePatterns: TitlePatternStat[];
  durationBuckets: DurationBucketStat[];
  topVideos: ScoredVideo[];
}
```

### 4. `src/types/api.ts`
```ts
export type TrendQuery =
  | { kind: 'category'; category: CategoryId; days: Days }
  | { kind: 'custom'; q: string; days: Days };
export type ApiErrorCode =
  | 'BAD_REQUEST' | 'MISSING_API_KEY' | 'QUOTA_EXCEEDED'
  | 'INVALID_KEY' | 'API_NOT_ENABLED' | 'UPSTREAM_ERROR' | 'INTERNAL_ERROR';
export interface ApiErrorBody { error: { code: ApiErrorCode; message: string } }
```

### 5. `src/types/index.ts` — 위 모듈 전부 re-export.

### 6. `src/lib/categories.ts`
```ts
export const CATEGORIES: Record<CategoryId, CategoryConfig>;
export const CATEGORY_IDS: CategoryId[];            // ['life-tips', 'quotes', 'self-reflection'] 순서 고정
export const CUSTOM_TEMPLATES: TemplateSet;         // 직접 입력 키워드용 범용 템플릿
export const DAYS_OPTIONS: Days[];                  // [7, 30, 90]
export function isCategoryId(value: unknown): value is CategoryId;
export function isDays(value: unknown): value is Days;
export function getTemplateSet(scope: ReportScope): TemplateSet;
```
- 카테고리 내용 (한국어):
  - `life-tips` / 라벨 `생활 꿀팁` / 시드: `생활꿀팁`, `살림 꿀팁`, `자취 꿀팁`
  - `quotes` / 라벨 `명언` / 시드: `명언`, `인생 명언`, `동기부여 명언`
  - `self-reflection` / 라벨 `자기객관화` / 시드: `자기객관화`, `자기성찰`, `메타인지`
- 템플릿은 카테고리 성격에 맞게 작성한다. 예: 생활 꿀팁 `"{keyword} 모르면 손해 보는 3가지"`, 명언 `"{keyword}에 대해 한 줄로 말하면"`, 자기객관화 `"{keyword}, 나만 그런 게 아니었다"`. 훅은 영상 첫 3초 대사 형태.

### 7. 테스트 (먼저 작성) — `src/lib/categories.test.ts`
- 모든 카테고리의 시드가 정확히 3개이고 비어 있지 않다
- 모든 템플릿 세트(CUSTOM 포함)가 제목 6개·훅 4개 이상, 모든 문장에 `{keyword}` 포함, 제목 key가 세트 안에서 고유
- `isCategoryId`, `isDays`가 올바른 값/잘못된 값(`'custom'`, `'x'`, `15`, `'30'`)을 구분
- `getTemplateSet('custom')`이 `CUSTOM_TEMPLATES`를 반환

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (타입은 `src/types/`)
   - ADR 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (생성한 타입 파일과 export 이름 포함)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 위에 명시된 타입 이름·필드 이름·유니온 값을 바꾸지 마라. 이유: step 2~9가 이 이름을 그대로 참조한다.
- 이 step에서 YouTube 호출, 분석 로직, UI를 만들지 마라. 이유: 이후 step의 범위다.
- 새 npm 패키지를 추가하지 마라. 이유: 필요한 의존성은 step 0에서 모두 설치했다.
- 기존 테스트를 깨뜨리지 마라
