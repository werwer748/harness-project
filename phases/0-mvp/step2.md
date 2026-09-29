# Step 2: youtube-service

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (CRITICAL 규칙: API 키 접근 위치, 실제 API 호출 금지)
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (ADR-004 쇼츠 판별)
- `/src/types/video.ts`, `/src/types/api.ts`, `/src/types/category.ts` (step 1)
- `/src/lib/categories.ts` (step 1)
- `/vitest.config.mts`, `/vitest.setup.ts` (step 0)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

YouTube Data API v3에서 한국 인기 쇼츠를 모아 `ShortVideo[]`로 돌려주는 서비스를 만든다. **테스트는 fixture JSON + fetch mock만 사용한다.**

### 1. `src/lib/duration.ts`
```ts
export function parseIsoDuration(iso: string): number;  // 'PT1M5S' → 65, 'PT45S' → 45, 'PT1H' → 3600, 'P0D' → 0, 형식 오류 → 0
```

### 2. `src/services/youtube.ts`
```ts
export type YouTubeErrorCode = 'MISSING_API_KEY' | 'QUOTA_EXCEEDED' | 'INVALID_KEY' | 'API_NOT_ENABLED' | 'UPSTREAM_ERROR';
export class YouTubeApiError extends Error {
  constructor(public readonly code: YouTubeErrorCode, message: string, public readonly status?: number);
}
export interface FetchShortsOptions {
  queries: string[];              // 카테고리 시드 3개 또는 사용자 키워드 1개
  days: number;                   // 7 | 30 | 90
  now: Date;
  maxResultsPerQuery?: number;    // 기본 25
}
export async function fetchShorts(options: FetchShortsOptions): Promise<ShortVideo[]>;
export const MAX_SHORT_DURATION_SEC = 180;
```

핵심 규칙:
- **API 키**: `process.env.YOUTUBE_API_KEY`를 `fetchShorts` 함수 **안에서** 읽는다(모듈 최상단 금지). trim 후 비어 있으면 fetch를 한 번도 하지 않고 `YouTubeApiError('MISSING_API_KEY', ...)`를 던진다.
- **search.list** (쿼리마다 1회): `https://www.googleapis.com/youtube/v3/search`
  - `part=snippet&type=video&videoDuration=short&regionCode=KR&relevanceLanguage=ko&order=viewCount&maxResults=25&q=<쿼리>&publishedAfter=<now - days일>&key=<키>`
  - `publishedAfter`는 밀리초 없는 RFC3339 (`2026-09-01T00:00:00Z`)
  - 쿼리들은 순차 호출해도 되고 `Promise.all`이어도 된다
  - 결과의 `items[].id.videoId`만 사용한다. search 결과의 제목은 HTML 이스케이프되어 있으므로 쓰지 않는다.
- ID는 등장 순서를 유지하며 중복 제거한다.
- **videos.list**: `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=<최대 50개 콤마>&key=<키>` — 50개 단위로 나눠 호출.
- 모든 fetch에 `{ next: { revalidate: 600 } }` 옵션을 준다 (쿼터 절약).
- **매핑** (`videos.list` item → `ShortVideo`):
  - `statistics.viewCount/likeCount/commentCount`는 문자열이며 없을 수 있다 → 숫자 변환, 없거나 NaN이면 0
  - `snippet.tags` 없으면 `[]`, 썸네일은 `high → medium → default` 순으로 첫 url, 없으면 `''`
  - `durationSec = parseIsoDuration(contentDetails.duration)`
- **필터**: `durationSec`가 1~180초이고 `snippet.liveBroadcastContent === 'none'`인 영상만 남긴다.
- **에러 매핑**: 응답이 `!ok`이면 body JSON의 `error.errors[].reason`과 `error.details[].reason`으로 판단한다 (HTTP status만으로 판단하지 마라):
  - `quotaExceeded` / `dailyLimitExceeded` / `rateLimitExceeded` → `QUOTA_EXCEEDED`
  - `keyInvalid` 또는 details reason `API_KEY_INVALID` → `INVALID_KEY`
  - `accessNotConfigured` 또는 details reason `SERVICE_DISABLED` → `API_NOT_ENABLED`
  - 그 외, JSON 파싱 실패, 네트워크 예외 → `UPSTREAM_ERROR`
  - 한국어 message를 붙인다. **message·로그에 요청 URL이나 API 키를 절대 포함하지 마라.**

### 3. Fixture — `src/services/__fixtures__/` (손으로 작성, 이후 step 3·4·5·9가 재사용)
- `search-page.json`: search.list 응답 형태. videoId 6개 이상.
- `videos-page.json`: videos.list 응답 형태. 한국어 제목·태그를 가진 영상 8개 이상. 다음을 반드시 포함:
  - 서로 다른 채널 3개 이상, 같은 키워드(예: `아침루틴`)가 서로 다른 두 채널의 영상에 등장
  - 180초 초과 영상 1개, `liveBroadcastContent: "live"` 영상 1개, `P0D` 영상 1개 (필터 테스트용)
  - `likeCount`가 없는 영상 1개 (숫자 기본값 테스트용)
  - 제목에 숫자·물음표·`방법`·해시태그(`#shorts`)가 들어간 것 각각 1개 이상
  - `publishedAt`은 2026-09-01 ~ 2026-09-28 사이 고정값
- `error-quota.json`, `error-key-invalid.json`, `error-not-enabled.json`: 각 에러 응답 body. 형태 예:
  ```json
  { "error": { "code": 403, "message": "...", "errors": [{ "reason": "quotaExceeded", "domain": "youtube.quota", "message": "..." }] } }
  ```
  key-invalid는 `code: 400`, `errors[0].reason: "badRequest"`, `details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", "reason": "API_KEY_INVALID" }]` 형태로.

### 4. 테스트 (먼저 작성)
- `src/lib/duration.test.ts`
- `src/services/youtube.test.ts`: `vi.stubGlobal('fetch', vi.fn(...))`로 fixture 응답을 돌려주고 `vi.stubEnv('YOUTUBE_API_KEY', 'test-key')` 사용. `afterEach`에서 `vi.unstubAllGlobals()`, `vi.unstubAllEnvs()`.
  - 키가 비어 있으면 `MISSING_API_KEY` + fetch 호출 0회
  - search URL에 필수 파라미터(`videoDuration=short`, `regionCode=KR`, `publishedAfter`)가 들어감
  - 쿼리 3개 → search 3회, 중복 ID 제거, videos.list는 50개 단위
  - 필터(180초 초과·라이브·P0D 제외)와 숫자 기본값
  - 에러 fixture 3종 → 각각 올바른 code, 네트워크 예외 → `UPSTREAM_ERROR`
  - 던진 에러의 message에 `test-key`가 포함되지 않음

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과 (실제 네트워크 호출 없이)
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `process.env.YOUTUBE_API_KEY`가 `src/services/youtube.ts` 밖에서 쓰이지 않는가? (`grep -rn "YOUTUBE_API_KEY" src` 로 확인)
   - ADR 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (export 이름과 fixture 파일 목록 포함)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단 (API 키가 비어 있는 것은 blocked 사유가 아니다 — 이 step은 mock으로 완료할 수 있다)

## 금지사항

- 실제 YouTube API를 호출하지 마라(`.env.local`에 키가 있더라도). 이유: 쿼터를 소모하고, 테스트가 네트워크에 의존하게 된다.
- `googleapis` 등 YouTube SDK 패키지를 추가하지 마라. 이유: 필요한 엔드포인트는 두 개뿐이고 의존성 최소화가 원칙이다(ADR 철학).
- 모듈 최상단에서 `process.env`를 읽지 마라. 이유: 키 없이도 `next build`가 통과해야 하고, 테스트에서 `vi.stubEnv`가 적용되어야 한다.
- 에러 message나 `console.*`에 URL·API 키를 넣지 마라. 이유: 키 유출.
- search.list에 페이지네이션(`pageToken`)을 넣지 마라. 이유: 쿼터 소모가 커진다.
- 기존 테스트를 깨뜨리지 마라
