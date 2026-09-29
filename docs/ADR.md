# Architecture Decision Records

## 철학
MVP 속도 최우선. 외부 의존성 최소화. 작동하는 최소 구현을 선택하고, 결정적이고 테스트 가능한 코드를 쓴다.

---

### ADR-001: Next.js 15 App Router + Route Handler
**결정**: Next.js 15.5.x App Router. YouTube 호출은 `app/api/trends` Route Handler를 통해서만 한다.
**이유**: 한 저장소에서 UI와 서버 코드를 함께 두면서 API 키를 서버에만 둘 수 있다.
**트레이드오프**: 16의 신기능은 쓰지 않는다. 별도 백엔드가 없어 무거운 배치 작업에는 맞지 않는다.

### ADR-002: 규칙 기반 추천 (LLM·NLP 라이브러리 미사용)
**결정**: 조회수·참여율·키워드 빈도 기반 점수와 카테고리별 템플릿으로 아이디어를 만든다. 형태소 분석기도 쓰지 않고 간단한 조사 제거 규칙만 쓴다.
**이유**: 비용 0, 키는 `YOUTUBE_API_KEY` 하나, 같은 입력에 같은 출력이 나와 테스트하기 쉽다.
**트레이드오프**: 제목·훅 문장이 템플릿 수준이고, 한국어 키워드 추출 정확도가 제한적이다.

### ADR-003: 저장은 localStorage만
**결정**: 사용자가 저장한 아이디어 스냅샷만 localStorage에 둔다.
**이유**: 로그인·DB 없이 바로 쓸 수 있다.
**트레이드오프**: 기기·브라우저 간 동기화가 안 되고, 브라우저 데이터를 지우면 사라진다.

### ADR-004: 쇼츠 판별은 길이 180초 이하
**결정**: `search.list`의 `videoDuration=short`(4분 미만)로 받은 뒤 `contentDetails.duration` ≤ 180초만 남긴다. 라이브·`P0D`는 제외한다.
**이유**: YouTube Data API에 쇼츠 전용 필터가 없다. 쇼츠 최대 길이가 3분이다.
**트레이드오프**: 3분 이하의 일반(가로) 영상이 섞일 수 있다.

### ADR-005: Tailwind v4 + ESLint flat config + Vitest
**결정**: Tailwind v4(`@tailwindcss/postcss`, `globals.css`에 `@import "tailwindcss"`, `tailwind.config` 없음). 린트는 `eslint .`(flat config, `eslint-config-next@15`), `next lint`는 쓰지 않는다. 테스트는 Vitest(기본 node 환경, 컴포넌트 테스트만 파일 상단 `// @vitest-environment jsdom`).
**이유**: Next 15.5의 기본 구성이고, `next lint`는 deprecated이며 설정이 없으면 대화형으로 멈춘다.
**트레이드오프**: v3 방식의 `tailwind.config.js` 예제는 그대로 쓸 수 없다.
