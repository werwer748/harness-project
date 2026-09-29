# 프로젝트: Shorts Idea Lab

## 기술 스택
- Next.js 15 (App Router) — 16 아님. `next@15.5.x` 고정
- TypeScript strict mode
- Tailwind CSS v4 (`@tailwindcss/postcss`, `tailwind.config` 파일 없음)
- 테스트: Vitest + React Testing Library

## 아키텍처 규칙
- CRITICAL: YouTube Data API 호출과 `process.env.YOUTUBE_API_KEY` 접근은 `src/services/youtube.ts`에서만, 서버(app/api 라우트 핸들러 경유)에서만 한다. 클라이언트 컴포넌트에서 외부 API를 직접 호출하지 말 것. 키에 `NEXT_PUBLIC_` 접두사를 붙이지 말 것
- CRITICAL: `src/lib/analysis/`는 순수 함수로만 작성한다. 네트워크, `process.env`, `Date.now()`/`new Date()`(인자 없는 현재 시각)에 접근하지 말고 `now`를 인자로 받는다. 같은 입력이면 항상 같은 출력이어야 한다
- CRITICAL: 어떤 작업도 실제 YouTube API 키나 YouTube 호출이 필요 없다(npm 패키지 설치만 네트워크 허용). 테스트는 fetch mock과 `src/services/__fixtures__/`의 JSON만 사용하고, 실제 YouTube API를 호출하지 않는다. `YOUTUBE_API_KEY`가 비어 있는 것은 blocked 사유가 아니다
- CRITICAL: `.env.local`, `.env.example`, `.gitignore`의 env 규칙을 수정·삭제하지 말 것
- 컴포넌트는 `src/components/`, 타입은 `src/types/`, 외부 API 래퍼는 `src/services/`에 둔다
- 브라우저 저장은 localStorage만 사용한다 (DB 없음)

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트
