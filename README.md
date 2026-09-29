# Shorts Idea Lab

요즘 잘 되는 한국어 쇼츠(생활 꿀팁 · 명언 · 자기객관화)를 분석해 다음에 만들 콘텐츠를 추천하는 대시보드입니다.

## 실행 방법

```bash
cp .env.example .env.local   # .env.local의 YOUTUBE_API_KEY에 키 입력
npm install
npm run dev                  # http://localhost:3000
```

키를 바꾼 뒤에는 개발 서버를 재시작해야 반영됩니다.

## API 키 발급

발급 절차는 `.env.example` 주석을 따릅니다. 요약하면 Google Cloud 프로젝트에서 **YouTube Data API v3**를 사용 설정하고 API 키를 만든 뒤, API 제한사항에서 YouTube Data API v3만 허용합니다.

- 키는 서버(`/api/trends`)에서만 쓰므로 **HTTP 리퍼러 제한을 걸지 마세요** (걸면 403).
- `NEXT_PUBLIC_` 접두사를 붙이지 마세요. 브라우저에 키가 노출됩니다.

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 (키 없이도 빌드됨) |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint |
| `npm test` | Vitest (실제 YouTube API를 호출하지 않음) |

## 쿼터 주의

- 분석 1회에 `search.list`를 최대 3회 호출합니다 (카테고리는 검색어 3개, 직접 입력은 1개). `search.list`는 호출당 100 유닛이라 기본 일일 할당량(10,000 유닛)으로는 카테고리 분석을 30회 남짓 할 수 있습니다.
- 같은 요청의 YouTube 응답은 서버에서 10분 동안 캐시합니다.
- 페이지를 열어도 자동으로 검색하지 않습니다. 분석하기를 눌렀을 때만 호출합니다.
