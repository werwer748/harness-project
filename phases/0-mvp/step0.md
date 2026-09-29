# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (특히 ADR-001, ADR-005)
- `/docs/UI_GUIDE.md`
- `/.gitignore`

이 저장소에는 아직 앱 코드가 없다. `scripts/`(Python harness), `.claude/`, `docs/`, `phases/`, `.env.example`, `.env.local`만 있다.

## 작업

Next.js 15 + TypeScript strict + Tailwind v4 + ESLint(flat config) + Vitest 프로젝트를 **수동으로** 구성한다.

### 1. `package.json` (직접 작성)
- `"name": "shorts-idea-lab"`, `"private": true`
- scripts (정확히 이 값):
  ```json
  { "dev": "next dev", "build": "next build", "start": "next start", "lint": "eslint .", "test": "vitest run" }
  ```
- 버전 고정 (정확한 버전으로):
  - dependencies: `next@15.5.26`, `react@19`, `react-dom@19` (19.x 최신)
  - devDependencies: `eslint-config-next@15.5.26`, `eslint@9`(9.x 최신, **10 금지**), `@eslint/eslintrc`, `typescript@5`, `@types/node`, `@types/react@19`, `@types/react-dom@19`, `tailwindcss@4`, `@tailwindcss/postcss@4`
  - 테스트용 devDependencies: `vitest`, `@vitejs/plugin-react`, `vite-tsconfig-paths`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event` (최신 안정 버전, 서로 호환되게)
- `npm install`로 `package-lock.json`을 생성한다.

### 2. 설정 파일
- `tsconfig.json`: Next 15 기본값 기반. `"strict": true`, `"paths": { "@/*": ["./src/*"] }`, `exclude`에 `node_modules`, `scripts`, `phases`, `coverage` 포함.
- `next.config.ts`: 빈 설정(`const nextConfig: NextConfig = {}`). 이미지 설정은 step 8에서 추가한다.
- `postcss.config.mjs`: `@tailwindcss/postcss` 플러그인만.
- `eslint.config.mjs`: `FlatCompat`으로 `next/core-web-vitals`, `next/typescript` 확장. ignores에 `.next/**`, `node_modules/**`, `next-env.d.ts`, `coverage/**`, `scripts/**`, `phases/**`.
- `vitest.config.mts`:
  - plugins: `@vitejs/plugin-react`, `vite-tsconfig-paths`
  - `test.environment: 'node'` (기본), `test.globals: false`, `test.setupFiles: ['./vitest.setup.ts']`, `test.include: ['src/**/*.test.{ts,tsx}']`
- `vitest.setup.ts`: `import '@testing-library/jest-dom/vitest'` 그리고 `afterEach(() => cleanup())` (`vitest`와 `@testing-library/react`에서 명시적 import).

### 3. 앱 골격
- `src/app/globals.css`: `@import "tailwindcss";` + body 배경 `#0a0a0a`, 텍스트 neutral-300 (UI_GUIDE 기준).
- `src/app/layout.tsx`: `<html lang="ko">`, `metadata = { title: 'Shorts Idea Lab', description: '유튜브 쇼츠 트렌드 분석과 다음 콘텐츠 추천' }`, globals.css import. 외부 폰트(next/font/google)는 쓰지 않는다.
- `src/app/page.tsx`: Server Component. `max-w-6xl mx-auto px-4` 컨테이너 안에 `<h1>Shorts Idea Lab</h1>`(UI_GUIDE 페이지 제목 스타일)과 한 줄 설명만. step 9에서 대시보드로 교체된다.
- 빈 디렉토리 자리 표시가 필요하면 만들지 말고 넘어간다 (`src/components` 등은 이후 step에서 생긴다).

### 4. 스모크 테스트 (TDD: 먼저 작성)
- `src/app/page.test.tsx` — 파일 첫 줄 `// @vitest-environment jsdom`. `Home` 페이지를 render하고 heading `Shorts Idea Lab`이 보이는지 확인.

## Acceptance Criteria

```bash
npm run lint    # ESLint 에러 없음
npm run build   # 컴파일 에러 없음 (YOUTUBE_API_KEY 없이도 성공해야 함)
npm test        # 스모크 테스트 통과
git check-ignore .env.local   # 출력: .env.local (여전히 무시되는지)
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가? (`next` 버전이 15.5.26인지 `npm ls next`로 확인)
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (생성한 설정 파일 목록과 테스트 환경 규칙을 포함)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단 (YouTube API 키가 비어 있는 것은 blocked 사유가 아니다)

## 금지사항

- `create-next-app`을 실행하지 마라. 이유: 비어 있지 않은 디렉토리를 거부하고, 대화형 프롬프트 때문에 headless 세션이 멈춘다.
- `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `phases/`, `.env.example`, `.env.local`을 수정하거나 덮어쓰지 마라. 이유: harness 가드레일과 사용자 비밀값이다.
- `.gitignore`를 교체하지 마라. 필요한 줄이 있으면 끝에 추가만 하라. 이유: `.env*` 무시 규칙이 사라지면 API 키가 커밋된다.
- `next lint`를 쓰지 마라. 이유: 15.5에서 deprecated이고 대화형 프롬프트가 뜰 수 있다.
- `tailwind.config.js`를 만들지 마라. 이유: Tailwind v4는 CSS 기반 설정이며 v3 설정 파일은 무시된다.
- Vitest `globals: true`를 쓰지 마라. 이유: 전역 타입이 없어 `next build`의 타입 검사가 테스트 파일에서 실패한다.
- `server-only` 패키지를 설치·import하지 마라. 이유: Vitest에서 import 시 예외가 난다.
- 기존 테스트를 깨뜨리지 마라
