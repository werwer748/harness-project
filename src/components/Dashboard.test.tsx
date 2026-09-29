// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AnalyzeOptions, analyzeShorts } from "@/lib/analysis";
import { toExcludedTerms } from "@/lib/analysis/tokenize";
import { CATEGORIES } from "@/lib/categories";
import { SAVED_IDEAS_KEY } from "@/lib/savedIdeas";
import videosPage from "@/services/__fixtures__/videos-page.json";
import { MAX_SHORT_DURATION_SEC, toShortVideo } from "@/services/youtube";
import type { ApiErrorBody, SavedIdea, ShortVideo, TrendQuery, TrendReport } from "@/types";
import Dashboard from "./Dashboard";

// SearchControls는 로딩 중 제출을 막는다. 경쟁 상태 테스트에서 두 번째 요청을 보낼 수 있도록
// 실제 컴포넌트를 그대로 렌더하면서 마지막으로 받은 onSubmit을 잡아 둔다
const searchControls = vi.hoisted(() => ({
  onSubmit: null as ((query: TrendQuery) => void) | null,
}));

vi.mock("./SearchControls", async (importOriginal) => {
  const { createElement } = await import("react");
  const actual = await importOriginal<typeof import("./SearchControls")>();
  type Props = Parameters<typeof actual.default>[0];
  return {
    default: function CapturingSearchControls(props: Props) {
      searchControls.onSubmit = props.onSubmit;
      return createElement(actual.default, props);
    },
  };
});

const NOW = new Date("2026-09-29T00:00:00Z");
const SEEDS = CATEGORIES["life-tips"].seedKeywords;
const INTRO = "카테고리를 고르고 분석하기를 누르세요.";
const EMPTY_RESULT = "조건에 맞는 쇼츠가 없습니다. 기간을 늘리거나 다른 키워드를 시도하세요.";

// fetchShorts와 같은 규칙으로 라이브·180초 초과·P0D 영상을 뺀다
const FIXTURE_VIDEOS: ShortVideo[] = videosPage.items
  .filter((item) => item.snippet.liveBroadcastContent === "none")
  .map(toShortVideo)
  .filter((video) => video.durationSec >= 1 && video.durationSec <= MAX_SHORT_DURATION_SEC);

// 라우트가 보내는 것과 같은 모양이 되도록 JSON 왕복을 거친다
function makeReport(videos: ShortVideo[], options: Partial<AnalyzeOptions> = {}): TrendReport {
  const report = analyzeShorts(videos, {
    scope: "life-tips",
    query: CATEGORIES["life-tips"].label,
    days: 30,
    excludedTerms: toExcludedTerms(SEEDS),
    fallbackKeywords: SEEDS,
    now: NOW,
    ...options,
  });
  return JSON.parse(JSON.stringify(report));
}

const LIFE_TIPS_REPORT = makeReport(FIXTURE_VIDEOS);
const CUSTOM_REPORT = makeReport(FIXTURE_VIDEOS, {
  scope: "custom",
  query: "아침루틴",
  days: 7,
  excludedTerms: toExcludedTerms(["아침루틴"]),
  fallbackKeywords: ["아침루틴"],
});
const EMPTY_REPORT = makeReport([]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(code: ApiErrorBody["error"]["code"], message: string, status: number) {
  const body: ApiErrorBody = { error: { code, message } };
  return jsonResponse(body, status);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function readStoredIdeas(): SavedIdea[] {
  const raw = localStorage.getItem(SAVED_IDEAS_KEY);
  return raw === null ? [] : JSON.parse(raw);
}

function savedPanel(): HTMLElement {
  const heading = screen.getByRole("heading", { name: /^저장한 아이디어/ });
  const panel = heading.closest("section");
  if (!panel) throw new Error("저장 패널을 찾지 못했습니다");
  return panel;
}

let fetchMock: Mock<typeof fetch>;

function setup() {
  const user = userEvent.setup();
  render(<Dashboard />);
  return { user };
}

async function submitDefaultSearch(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "분석하기" }));
}

// 로딩 중에도 새 요청을 보낸다. onSubmit이 돌려주는 Promise를 act에 넘기지 않도록 버린다
function submitDirectly(query: TrendQuery) {
  const onSubmit = searchControls.onSubmit;
  if (!onSubmit) throw new Error("SearchControls가 렌더되지 않았습니다");
  act(() => {
    onSubmit(query);
  });
}

beforeEach(() => {
  localStorage.clear();
  searchControls.onSubmit = null;
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Dashboard", () => {
  describe("초기 상태", () => {
    it("안내 문구를 보여 주고 자동으로 검색하지 않는다", () => {
      setup();

      expect(screen.getByText(INTRO)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "분석하기" })).toBeEnabled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("마운트 후 localStorage의 저장 목록을 불러온다", async () => {
      const stored: SavedIdea = { ...LIFE_TIPS_REPORT.ideas[0], savedAt: NOW.toISOString() };
      localStorage.setItem(SAVED_IDEAS_KEY, JSON.stringify([stored]));
      setup();

      expect(
        await screen.findByRole("heading", { name: "저장한 아이디어 (1)" }),
      ).toBeInTheDocument();
      expect(within(savedPanel()).getByText(stored.keyword)).toBeInTheDocument();
    });

    it("렌더 중에는 localStorage를 읽지 않는다 (서버 렌더와 첫 렌더 일치)", () => {
      localStorage.setItem(
        SAVED_IDEAS_KEY,
        JSON.stringify([{ ...LIFE_TIPS_REPORT.ideas[0], savedAt: NOW.toISOString() }]),
      );
      const getItem = vi.spyOn(Storage.prototype, "getItem");

      const html = renderToString(<Dashboard />);

      expect(getItem).not.toHaveBeenCalled();
      expect(html).toContain("저장한 아이디어 (<!-- -->0<!-- -->)");
      expect(html).toContain(INTRO);
    });
  });

  describe("검색", () => {
    it("분석하기를 누르면 /api/trends를 호출하고 리포트를 순서대로 렌더한다", async () => {
      fetchMock.mockResolvedValue(jsonResponse(LIFE_TIPS_REPORT));
      const { user } = setup();

      await submitDefaultSearch(user);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe("/api/trends?category=life-tips&days=30");

      expect(
        await screen.findByRole("heading", { name: "생활 꿀팁 · 최근 30일" }),
      ).toBeInTheDocument();
      expect(screen.queryByText(INTRO)).not.toBeInTheDocument();

      // 아이디어 카드
      expect(LIFE_TIPS_REPORT.ideas.length).toBeGreaterThan(0);
      expect(screen.getAllByRole("article")).toHaveLength(LIFE_TIPS_REPORT.ideas.length);
      for (const idea of LIFE_TIPS_REPORT.ideas) {
        expect(screen.getByRole("article", { name: idea.keyword })).toBeInTheDocument();
      }

      // 키워드 표
      const keywordTable = screen.getByRole("table", { name: "뜨는 키워드" });
      for (const stat of LIFE_TIPS_REPORT.keywords) {
        expect(within(keywordTable).getByText(stat.keyword)).toBeInTheDocument();
      }

      // 요약 → 추천 → 키워드 → 패턴 → 영상 표 → 저장 패널 순서
      expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
        "생활 꿀팁 · 최근 30일",
        "다음 콘텐츠 추천",
        "뜨는 키워드",
        "제목 패턴",
        "영상 길이",
        `잘 되는 쇼츠 TOP ${LIFE_TIPS_REPORT.topVideos.length}`,
        "저장한 아이디어 (0)",
      ]);
    });

    it("직접 입력한 키워드는 q로 보낸다", async () => {
      fetchMock.mockResolvedValue(jsonResponse(CUSTOM_REPORT));
      const { user } = setup();

      await user.type(screen.getByRole("textbox", { name: "직접 키워드" }), " 아침루틴 ");
      await user.selectOptions(screen.getByRole("combobox", { name: "기간" }), "7");
      await submitDefaultSearch(user);

      const url = String(fetchMock.mock.calls[0][0]);
      expect(url.startsWith("/api/trends?")).toBe(true);
      const params = new URLSearchParams(url.slice(url.indexOf("?") + 1));
      expect(params.get("q")).toBe("아침루틴");
      expect(params.get("days")).toBe("7");
      expect(params.has("category")).toBe(false);
      expect(await screen.findByRole("heading", { name: "아침루틴 · 최근 7일" })).toBeInTheDocument();
    });

    it("응답을 기다리는 동안 결과 영역을 스켈레톤으로 표시한다", async () => {
      const pending = deferred<Response>();
      fetchMock.mockReturnValue(pending.promise);
      const { user } = setup();

      await submitDefaultSearch(user);

      const status = screen.getByRole("status");
      expect(status.querySelector(".animate-pulse")).not.toBeNull();
      expect(screen.getByRole("button", { name: "분석 중…" })).toBeDisabled();
      expect(screen.queryByText(INTRO)).not.toBeInTheDocument();

      await act(async () => pending.resolve(jsonResponse(LIFE_TIPS_REPORT)));

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "분석하기" })).toBeEnabled();
      expect(screen.getByRole("heading", { name: "생활 꿀팁 · 최근 30일" })).toBeInTheDocument();
    });

    it("영상이 0개면 표 대신 안내 문구를 보여 주고 fallback 아이디어는 유지한다", async () => {
      fetchMock.mockResolvedValue(jsonResponse(EMPTY_REPORT));
      const { user } = setup();

      await submitDefaultSearch(user);

      expect(await screen.findByText(EMPTY_RESULT)).toBeInTheDocument();
      expect(screen.queryAllByRole("table")).toHaveLength(0);
      expect(EMPTY_REPORT.ideas.length).toBeGreaterThan(0);
      expect(screen.getAllByRole("article")).toHaveLength(EMPTY_REPORT.ideas.length);
      expect(screen.getAllByText("기본 제안")).toHaveLength(EMPTY_REPORT.ideas.length);
    });
  });

  describe("에러", () => {
    it("MISSING_API_KEY면 message와 .env.local 설정 안내를 보여 준다", async () => {
      const message = ".env.local에 YOUTUBE_API_KEY를 설정한 뒤 개발 서버를 재시작하세요.";
      fetchMock.mockResolvedValue(errorResponse("MISSING_API_KEY", message, 500));
      const { user } = setup();

      await submitDefaultSearch(user);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(message);
      expect(alert).toHaveTextContent("cp .env.example .env.local");
      expect(screen.queryByText(INTRO)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "분석하기" })).toBeEnabled();
    });

    it("다른 에러 코드는 message만 보여 준다", async () => {
      const message = "오늘 YouTube API 할당량을 모두 썼습니다. 내일 다시 시도하세요.";
      fetchMock.mockResolvedValue(errorResponse("QUOTA_EXCEEDED", message, 429));
      const { user } = setup();

      await submitDefaultSearch(user);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(message);
      expect(alert).not.toHaveTextContent(".env.example");
    });

    it("응답 JSON을 파싱하지 못하면 기본 에러 message를 보여 준다", async () => {
      fetchMock.mockResolvedValue(new Response("<html>Bad Gateway</html>", { status: 502 }));
      const { user } = setup();

      await submitDefaultSearch(user);

      expect(await screen.findByRole("alert")).toHaveTextContent("요청을 처리하지 못했습니다");
    });

    it("에러 응답 body에 error가 없으면 기본 에러 message를 보여 준다", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ unexpected: true }, 500));
      const { user } = setup();

      await submitDefaultSearch(user);

      expect(await screen.findByRole("alert")).toHaveTextContent("요청을 처리하지 못했습니다");
    });

    it("네트워크 예외도 에러로 표시한다", async () => {
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
      const { user } = setup();

      await submitDefaultSearch(user);

      const alert = await screen.findByRole("alert");
      expect(alert.textContent?.trim()).not.toBe("");
      expect(alert).not.toHaveTextContent("Failed to fetch");
      expect(screen.getByRole("button", { name: "분석하기" })).toBeEnabled();
    });

    it("다시 검색해 성공하면 에러를 지운다", async () => {
      fetchMock
        .mockResolvedValueOnce(errorResponse("UPSTREAM_ERROR", "YouTube 응답 오류", 502))
        .mockResolvedValueOnce(jsonResponse(LIFE_TIPS_REPORT));
      const { user } = setup();

      await submitDefaultSearch(user);
      expect(await screen.findByRole("alert")).toHaveTextContent("YouTube 응답 오류");

      await submitDefaultSearch(user);
      expect(
        await screen.findByRole("heading", { name: "생활 꿀팁 · 최근 30일" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("저장", () => {
    it("저장을 누르면 localStorage와 저장 패널에 반영되고, 다시 누르면 해제된다", async () => {
      fetchMock.mockResolvedValue(jsonResponse(LIFE_TIPS_REPORT));
      const { user } = setup();
      await submitDefaultSearch(user);

      const idea = LIFE_TIPS_REPORT.ideas[0];
      const card = await screen.findByRole("article", { name: idea.keyword });
      await user.click(within(card).getByRole("button", { name: "저장" }));

      const stored = readStoredIdeas();
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe(idea.id);
      expect(stored[0].titles).toEqual(idea.titles);
      expect(within(card).getByRole("button", { name: "저장됨" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("heading", { name: "저장한 아이디어 (1)" })).toBeInTheDocument();
      expect(within(savedPanel()).getByText(idea.keyword)).toBeInTheDocument();

      await user.click(within(card).getByRole("button", { name: "저장됨" }));

      expect(readStoredIdeas()).toEqual([]);
      expect(within(card).getByRole("button", { name: "저장" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      expect(screen.getByRole("heading", { name: "저장한 아이디어 (0)" })).toBeInTheDocument();
    });

    it("저장 패널에서 삭제하면 카드의 저장 상태도 풀린다", async () => {
      fetchMock.mockResolvedValue(jsonResponse(LIFE_TIPS_REPORT));
      const { user } = setup();
      await submitDefaultSearch(user);

      const idea = LIFE_TIPS_REPORT.ideas[0];
      const card = await screen.findByRole("article", { name: idea.keyword });
      await user.click(within(card).getByRole("button", { name: "저장" }));
      await user.click(
        within(savedPanel()).getByRole("button", { name: `${idea.keyword} 삭제` }),
      );

      expect(readStoredIdeas()).toEqual([]);
      expect(within(card).getByRole("button", { name: "저장" })).toBeInTheDocument();
    });

    it("이미 저장된 아이디어는 리포트에서 저장됨으로 표시한다", async () => {
      const idea = LIFE_TIPS_REPORT.ideas[0];
      localStorage.setItem(
        SAVED_IDEAS_KEY,
        JSON.stringify([{ ...idea, savedAt: NOW.toISOString() }]),
      );
      fetchMock.mockResolvedValue(jsonResponse(LIFE_TIPS_REPORT));
      const { user } = setup();
      await submitDefaultSearch(user);

      const card = await screen.findByRole("article", { name: idea.keyword });
      expect(within(card).getByRole("button", { name: "저장됨" })).toBeInTheDocument();
    });
  });

  describe("경쟁 상태", () => {
    it("먼저 보낸 요청이 늦게 도착해도 마지막 요청 결과만 표시한다", async () => {
      const first = deferred<Response>();
      const second = deferred<Response>();
      fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const { user } = setup();

      await submitDefaultSearch(user);
      submitDirectly({ kind: "custom", q: "아침루틴", days: 7 });
      expect(fetchMock).toHaveBeenCalledTimes(2);

      await act(async () => second.resolve(jsonResponse(CUSTOM_REPORT)));
      expect(screen.getByRole("heading", { name: "아침루틴 · 최근 7일" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "분석하기" })).toBeEnabled();

      await act(async () => first.resolve(jsonResponse(LIFE_TIPS_REPORT)));
      expect(screen.getByRole("heading", { name: "아침루틴 · 최근 7일" })).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "생활 꿀팁 · 최근 30일" }),
      ).not.toBeInTheDocument();
    });

    it("이전 요청이 실패로 끝나도 마지막 요청 결과를 덮지 않는다", async () => {
      const first = deferred<Response>();
      const second = deferred<Response>();
      fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const { user } = setup();

      await submitDefaultSearch(user);
      submitDirectly({ kind: "custom", q: "아침루틴", days: 7 });

      await act(async () => second.resolve(jsonResponse(CUSTOM_REPORT)));
      await act(async () => first.reject(new TypeError("Failed to fetch")));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "아침루틴 · 최근 7일" })).toBeInTheDocument();
    });

    it("마지막 요청이 끝나기 전에는 이전 요청이 도착해도 로딩을 유지한다", async () => {
      const first = deferred<Response>();
      const second = deferred<Response>();
      fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const { user } = setup();

      await submitDefaultSearch(user);
      submitDirectly({ kind: "custom", q: "아침루틴", days: 7 });

      await act(async () => first.resolve(jsonResponse(LIFE_TIPS_REPORT)));
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "생활 꿀팁 · 최근 30일" }),
      ).not.toBeInTheDocument();

      await act(async () => second.resolve(jsonResponse(CUSTOM_REPORT)));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "아침루틴 · 최근 7일" })).toBeInTheDocument();
    });
  });
});
