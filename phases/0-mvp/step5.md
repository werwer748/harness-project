# Step 5: api-route

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (CRITICAL: API 키·외부 호출 위치)
- `/docs/ARCHITECTURE.md` (데이터 흐름)
- `/docs/ADR.md` (ADR-001)
- `/src/types/api.ts`, `/src/types/category.ts`, `/src/types/report.ts` (step 1)
- `/src/lib/categories.ts` (step 1)
- `/src/services/youtube.ts` (step 2 — `fetchShorts`, `YouTubeApiError`)
- `/src/lib/analysis/index.ts`, `/src/lib/analysis/tokenize.ts` (step 3·4 — `analyzeShorts`, `toExcludedTerms`)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

클라이언트와 서버가 공유하는 쿼리 규약과 `GET /api/trends` 라우트 핸들러를 만든다.

### 1. `src/lib/trendQuery.ts` (클라이언트·서버 공용, 순수)
```ts
export const MAX_QUERY_LENGTH = 50;
export type ParseResult = { ok: true; query: TrendQuery } | { ok: false; message: string };
export function parseTrendQuery(params: URLSearchParams): ParseResult;
export function toTrendSearchParams(query: TrendQuery): URLSearchParams;
```
- `q`가 있고 trim 후 비어 있지 않으면 → `{ kind: 'custom', q: trim된 값, days }`. `category`는 무시한다.
  - 50자 초과면 에러
- 아니면 `category`가 `isCategoryId`를 통과해야 한다 → `{ kind: 'category', category, days }`
- `days`: 없으면 30, 있으면 `7 | 30 | 90`만 허용 (`'15'`, `'abc'`는 에러)
- 에러 message는 한국어 (예: `"category는 life-tips, quotes, self-reflection 중 하나여야 합니다"`)
- `toTrendSearchParams` → `parseTrendQuery` 왕복이 원래 값과 같아야 한다.

### 2. `src/app/api/trends/route.ts`
```ts
export const dynamic = 'force-dynamic';
export async function GET(request: Request): Promise<Response>;
```
흐름:
1. `parseTrendQuery(new URL(request.url).searchParams)` 실패 → 400 `{ error: { code: 'BAD_REQUEST', message } }`
2. 쿼리 구성:
   - category면 `queries = CATEGORIES[c].seedKeywords`, `query` 표시값 = 카테고리 라벨, `fallbackKeywords` = 시드
   - custom이면 `queries = [q]`, 표시값 = q, `fallbackKeywords = [q]`
3. `now = new Date()` (라우트에서만 현재 시각 생성)
4. `fetchShorts({ queries, days, now })`
5. `analyzeShorts(videos, { scope, query, days, excludedTerms: toExcludedTerms(queries), fallbackKeywords, now })`
6. `Response.json(report)` (200)

에러 매핑 (`YouTubeApiError.code` 기준):
| code | status | message 요지 |
|---|---|---|
| MISSING_API_KEY | 500 | `.env.local`에 YOUTUBE_API_KEY를 설정한 뒤 개발 서버를 재시작하세요 |
| QUOTA_EXCEEDED | 429 | 오늘 YouTube API 할당량을 모두 썼습니다. 내일 다시 시도하세요 |
| INVALID_KEY | 502 | YOUTUBE_API_KEY가 올바르지 않습니다 |
| API_NOT_ENABLED | 502 | Google Cloud에서 YouTube Data API v3를 사용 설정하세요 |
| UPSTREAM_ERROR | 502 | YouTube 응답을 처리하지 못했습니다 |
| (그 외 예외) | 500 | `INTERNAL_ERROR`, 일반 메시지 |

- 응답 body는 항상 `ApiErrorBody` 형태: `{ error: { code, message } }`
- `console.error`로 남길 때는 `code`와 `message`만 쓰고, 원본 에러 객체·URL·키는 쓰지 않는다.

### 3. 테스트 (먼저 작성)
- `src/lib/trendQuery.test.ts`: 정상 3종(category, custom, days 기본값), 에러(카테고리 없음, 잘못된 카테고리, 잘못된 days, 51자 q, 공백만 있는 q → category로 판단), 왕복.
- `src/app/api/trends/route.test.ts` (node 환경, jsdom 금지):
  - `vi.mock('@/services/youtube', async (importOriginal) => ({ ...(await importOriginal()), fetchShorts: vi.fn() }))`로 `YouTubeApiError`는 실제 클래스를 유지한다
  - `GET(new Request('http://localhost/api/trends?category=quotes&days=7'))`
  - 200 + TrendReport 형태, fetchShorts가 시드 3개와 days 7로 호출되는지
  - custom q → queries `[q]`
  - 400 (잘못된 쿼리) → fetchShorts 호출 0회
  - 에러 code 5종 + 일반 Error → 표의 status와 code
  - fetchShorts mock은 step 2 fixture를 ShortVideo로 변환한 값이나 인라인 배열을 반환한다

## Acceptance Criteria

```bash
npm run lint
npm run build   # YOUTUBE_API_KEY 없이 성공해야 함 (빌드 로그에 /api/trends가 ƒ Dynamic으로 표시)
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 라우트가 YouTube를 직접 fetch하지 않고 `services/youtube.ts`만 경유하는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (엔드포인트 규약·에러 status 매핑·trendQuery export 포함)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단 (API 키가 비어 있는 것은 blocked 사유가 아니다)

## 금지사항

- `next dev`를 띄워 실제 `/api/trends`를 호출하는 방식으로 검증하지 마라. 이유: `.env.local`에 키가 있으면 실제 쿼터를 소모한다. 라우트는 `GET` 함수를 직접 호출해 테스트한다.
- 모듈 최상단에서 `process.env`를 읽거나 `new Date()`를 만들지 마라. 이유: 빌드 시점 값이 고정되고, 키 없이 빌드가 실패할 수 있다.
- 라우트 테스트 파일에 `// @vitest-environment jsdom`을 붙이지 마라. 이유: jsdom의 AbortSignal이 `Request` 생성과 충돌한다.
- `NextRequest`, `next/server`의 런타임 전용 API에 의존하지 마라. 이유: 표준 `Request`/`Response`로 충분하고 테스트가 단순해진다.
- 기존 테스트를 깨뜨리지 마라
