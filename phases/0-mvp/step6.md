# Step 6: saved-ideas

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (상태 관리: localStorage)
- `/docs/ADR.md` (ADR-003)
- `/src/types/report.ts` (step 1 — `ContentIdea`, `SavedIdea`)
- `/src/lib/analysis/recommend.ts` (step 4 — 아이디어 id 규칙)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

추천 아이디어 북마크를 localStorage에 저장·조회·삭제하는 모듈을 만든다. 파일: `src/lib/savedIdeas.ts`

```ts
export const SAVED_IDEAS_KEY = 'shorts-idea-lab:saved-ideas:v1';
export const MAX_SAVED_IDEAS = 100;
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export function getBrowserStorage(): StorageLike | null;
export function loadSavedIdeas(storage?: StorageLike | null): SavedIdea[];
export function saveIdea(idea: ContentIdea, now: Date, storage?: StorageLike | null): SavedIdea[];
export function removeIdea(id: string, storage?: StorageLike | null): SavedIdea[];
export function isIdeaSaved(ideas: SavedIdea[], id: string): boolean;
```

핵심 규칙:
- `getBrowserStorage`: `typeof window === 'undefined'`면 `null`. `window.localStorage` 접근 자체가 던질 수 있으므로(사파리 프라이빗 모드 등) try/catch로 감싸고, 실패하면 `null`.
- `storage` 인자를 생략하면 `getBrowserStorage()`를 쓴다. `null`이면 읽기는 `[]`, 쓰기는 저장 없이 계산된 목록만 반환한다.
- `loadSavedIdeas`: JSON 파싱 실패, 배열이 아님, 필수 필드(`id`, `keyword`, `titles`, `savedAt`)가 빠진 항목 → 그 항목(또는 전체)을 무시하고 **절대 던지지 않는다**.
- `saveIdea`:
  - 같은 `id`가 이미 있으면 목록을 바꾸지 않는다 (멱등)
  - 없으면 `{ ...idea, savedAt: now.toISOString() }`를 **맨 앞**에 추가하고, `MAX_SAVED_IDEAS`를 넘으면 뒤(오래된 것)를 자른다
  - 아이디어 스냅샷 전체를 저장한다. 리포트가 바뀌어도 저장된 내용이 그대로 보여야 하기 때문이다
- `setItem`이 던지면(용량 초과) 삼키고, 계산된 목록을 반환한다.
- 이 모듈은 React를 import하지 않는다 (훅은 step 9에서 Dashboard가 직접 구성).

### 테스트 (먼저 작성) — `src/lib/savedIdeas.test.ts` (node 환경)
- `Map` 기반 인메모리 `StorageLike` 가짜 객체를 테스트 안에서 만든다.
- 빈 저장소 → `[]`
- 저장 → 조회 왕복, 최신이 맨 앞
- 같은 id 두 번 저장 → 1개 (멱등)
- 삭제
- 손상된 JSON, 객체 JSON, 필수 필드 누락 항목 섞임 → 예외 없음, 유효 항목만 남음
- `MAX_SAVED_IDEAS` 초과 시 잘림
- `setItem`이 던지는 저장소 → 예외 없이 목록 반환
- `storage = null` → 읽기 `[]`, 쓰기 예외 없음
- node 환경(window 없음)에서 `getBrowserStorage()` → `null`

## Acceptance Criteria

```bash
npm run lint
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (`src/lib/savedIdeas.ts`)
   - ADR-003(localStorage만)을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (export 함수와 저장 키 포함)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 모듈 최상단에서 `window`나 `localStorage`에 접근하지 마라. 이유: 서버 렌더링 시 `ReferenceError`가 난다.
- `zustand`, `idb` 등 상태·저장 라이브러리를 추가하지 마라. 이유: ADR-003, 의존성 최소화.
- 아이디어 id를 새로 만들거나 바꾸지 마라(`crypto.randomUUID` 등). 이유: 중복 제거는 step 4가 만든 결정적 id에 의존한다.
- 기존 테스트를 깨뜨리지 마라
