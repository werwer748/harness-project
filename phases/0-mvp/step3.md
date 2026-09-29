# Step 3: text-tokenizer

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (CRITICAL: `src/lib/analysis/`는 순수 함수)
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (ADR-002: 형태소 분석기 미사용)
- `/src/types/video.ts` (step 1)
- `/src/services/__fixtures__/videos-page.json` (step 2 — 실제 제목·태그 예시)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

쇼츠 제목·태그에서 키워드 후보를 뽑는 한국어 토크나이저를 **외부 라이브러리 없이** 만든다. 파일: `src/lib/analysis/tokenize.ts`

```ts
export const STOPWORDS: ReadonlySet<string>;
export function normalizeText(text: string): string;
export function tokenize(text: string): string[];
export function buildVocabulary(texts: string[]): Set<string>;
export function stripParticle(token: string, vocabulary: ReadonlySet<string>): string;
export function toExcludedTerms(queries: string[]): Set<string>;
export function extractVideoTerms(
  video: { title: string; tags: string[] },
  vocabulary: ReadonlySet<string>,
  excluded: ReadonlySet<string>,
): string[];
```

동작 규칙:
- `normalizeText`: NFC 정규화, 영문 소문자화, 이모지·기호·구두점·`#`·`@`를 공백으로 바꾼다. 한글·영문·숫자만 남긴다.
- `tokenize`: `normalizeText` 후 공백으로 분리. 다음은 버린다:
  - 순수 숫자 토큰(`3`, `2026`)
  - 한 글자 토큰
  - `STOPWORDS`에 있는 토큰
- `STOPWORDS`에 최소 다음을 포함한다: `shorts`, `short`, `쇼츠`, `숏츠`, `유튜브`, `영상`, `구독`, `좋아요`, `댓글`, `알림`, `오늘`, `진짜`, `정말`, `그냥`, `이것`, `그것`, `하는`, `있는`, `없는`, `모든`, `가지`, `방법`. `방법`처럼 제목 패턴 분석에서 따로 다루는 단어도 키워드로는 제외한다.
- `buildVocabulary(texts)`: 모든 텍스트를 `tokenize`한 원형 토큰 집합. 조사 제거 판단에 쓴다.
- `stripParticle(token, vocabulary)`:
  - 다음절 조사(`에서`, `으로`, `처럼`, `까지`, `부터`, `에게`, `한테`, `보다`, `이라는`, `라는`, `이란`)로 끝나면 제거한다. 단, 남는 어간이 2글자 이상일 때만.
  - 단음절 조사(`은`, `는`, `이`, `가`, `을`, `를`, `의`, `도`, `만`, `와`, `과`, `로`, `에`)는 **남는 어간이 2글자 이상이고 그 어간이 `vocabulary`에 독립 토큰으로도 존재할 때만** 제거한다.
  - 예: vocabulary에 `효과`가 있어도 `효과` 자체는 그대로다(`과`를 떼면 1글자). `아침루틴은` + vocabulary에 `아침루틴` → `아침루틴`. `고양이` + vocabulary에 `고양` 없음 → `고양이`.
- `toExcludedTerms(queries)`: 검색어들을 tokenize하고, 공백을 뺀 전체 문자열도 함께 넣은 집합. 예: `['인생 명언']` → `{'인생', '명언', '인생명언'}`.
- `extractVideoTerms`: 제목과 각 태그를 tokenize → `stripParticle` → `excluded` 제외 → 다시 STOPWORDS 제외 → **영상 안에서 중복 제거**한 배열(첫 등장 순서).
- 모든 함수는 순수 함수다. 전역 상태와 `Date`, 네트워크, env를 쓰지 않는다.

### 테스트 (먼저 작성) — `src/lib/analysis/tokenize.test.ts`
- 이모지·해시태그·구두점 처리: `'🔥자취 꿀팁 #shorts!!'` → `['자취', '꿀팁']`
- NFD로 입력한 한글이 NFC 입력과 같은 결과
- 숫자·한 글자·불용어 제거
- 조사 규칙: 위 예시 3개 + `집에서` → `집에서`(어간 1글자) + `냉장고에서` → `냉장고`
- `toExcludedTerms` 예시
- `extractVideoTerms`: 제목과 태그에 같은 단어가 있어도 1번만, excluded 제외
- step 2의 `videos-page.json` fixture 전체에 적용해도 예외가 없고, 결과에 빈 문자열이 없음

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/lib/analysis/tokenize.ts`에 `Date`, `process.env`, `fetch`가 없는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (export 함수 이름 포함)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 형태소 분석기나 NLP 패키지(`mecab`, `open-korean-text`, `kiwi` 등)를 추가하지 마라. 이유: ADR-002, 의존성 최소화.
- 단음절 조사를 무조건 떼지 마라. 이유: `효과→효`, `고양이→고양`, `정도→정`처럼 명사가 망가진다.
- `description`(영상 설명)은 토큰화 대상에 넣지 마라. 이유: 링크·반복 해시태그 노이즈가 커서 키워드가 오염된다.
- 기존 테스트를 깨뜨리지 마라
