import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AnalyzeOptions, analyzeShorts } from "@/lib/analysis";
import { toExcludedTerms } from "@/lib/analysis/tokenize";
import { CATEGORIES } from "@/lib/categories";
import videosPage from "@/services/__fixtures__/videos-page.json";
import {
  MAX_SHORT_DURATION_SEC,
  YouTubeApiError,
  type YouTubeErrorCode,
  fetchShorts,
  toShortVideo,
} from "@/services/youtube";
import type { ApiErrorBody, ApiErrorCode, ShortVideo, TrendReport } from "@/types";
import { GET, dynamic } from "./route";

// YouTubeApiError·toShortVideo는 실제 구현을 쓰고 fetchShorts만 대체한다
vi.mock("@/services/youtube", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/youtube")>()),
  fetchShorts: vi.fn(),
}));

const fetchShortsMock = vi.mocked(fetchShorts);
const NOW = new Date("2026-09-29T00:00:00Z");

// fetchShorts와 같은 규칙으로 라이브·180초 초과·P0D 영상을 뺀다
const FIXTURE_VIDEOS: ShortVideo[] = videosPage.items
  .filter((item) => item.snippet.liveBroadcastContent === "none")
  .map(toShortVideo)
  .filter((video) => video.durationSec >= 1 && video.durationSec <= MAX_SHORT_DURATION_SEC);

function get(search: string): Promise<Response> {
  return GET(new Request(`http://localhost/api/trends${search}`));
}

// JSON 직렬화를 거친 값과 비교해야 응답 body와 같은 모양이 된다
function expectedReport(videos: ShortVideo[], options: AnalyzeOptions): TrendReport {
  return JSON.parse(JSON.stringify(analyzeShorts(videos, options)));
}

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  fetchShortsMock.mockReset();
  fetchShortsMock.mockResolvedValue(FIXTURE_VIDEOS);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GET /api/trends", () => {
  it("is always rendered dynamically", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("fetches a category's seed keywords and returns a TrendReport", async () => {
    const response = await get("?category=quotes&days=7");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const seeds = CATEGORIES.quotes.seedKeywords;
    expect(fetchShortsMock).toHaveBeenCalledTimes(1);
    expect(fetchShortsMock).toHaveBeenCalledWith({ queries: seeds, days: 7, now: NOW });

    const body = (await response.json()) as TrendReport;
    expect(body).toEqual(
      expectedReport(FIXTURE_VIDEOS, {
        scope: "quotes",
        query: CATEGORIES.quotes.label,
        days: 7,
        excludedTerms: toExcludedTerms(seeds),
        fallbackKeywords: seeds,
        now: NOW,
      }),
    );
    expect(body.scope).toBe("quotes");
    expect(body.query).toBe("명언");
    expect(body.days).toBe(7);
    expect(body.generatedAt).toBe(NOW.toISOString());
    expect(body.summary.videoCount).toBe(FIXTURE_VIDEOS.length);
    expect(body.ideas.length).toBeGreaterThan(0);
    expect(body.keywords.length).toBeGreaterThan(0);
    expect(body.titlePatterns).toHaveLength(4);
    expect(body.durationBuckets).toHaveLength(4);
    expect(body.topVideos).toHaveLength(FIXTURE_VIDEOS.length);
  });

  it("defaults days to 30", async () => {
    const response = await get("?category=life-tips");

    expect(response.status).toBe(200);
    expect(fetchShortsMock).toHaveBeenCalledWith({
      queries: CATEGORIES["life-tips"].seedKeywords,
      days: 30,
      now: NOW,
    });
    expect(((await response.json()) as TrendReport).days).toBe(30);
  });

  it("searches only the custom q and excludes it from keywords", async () => {
    const q = "아침 루틴";
    const response = await get(`?${new URLSearchParams({ q, category: "quotes", days: "90" })}`);

    expect(response.status).toBe(200);
    expect(fetchShortsMock).toHaveBeenCalledWith({ queries: [q], days: 90, now: NOW });

    const body = (await response.json()) as TrendReport;
    expect(body).toEqual(
      expectedReport(FIXTURE_VIDEOS, {
        scope: "custom",
        query: q,
        days: 90,
        excludedTerms: toExcludedTerms([q]),
        fallbackKeywords: [q],
        now: NOW,
      }),
    );
    expect(body.scope).toBe("custom");
    expect(body.query).toBe(q);
    expect(body.keywords.map((stat) => stat.keyword)).not.toContain("아침루틴");
  });

  it("falls back to the custom q when no videos are found", async () => {
    fetchShortsMock.mockResolvedValue([]);

    const response = await get("?q=%EC%8A%B5%EA%B4%80");

    expect(response.status).toBe(200);
    const body = (await response.json()) as TrendReport;
    expect(body.summary.videoCount).toBe(0);
    expect(body.ideas).toHaveLength(1);
    expect(body.ideas[0]).toMatchObject({ keyword: "습관", fallback: true });
  });

  it.each([
    ["no parameters", ""],
    ["an unknown category", "?category=music"],
    ["invalid days", "?category=quotes&days=15"],
    ["non-numeric days", "?q=%EC%8A%B5%EA%B4%80&days=abc"],
    ["a q longer than 50 characters", `?q=${encodeURIComponent("가".repeat(51))}`],
    ["a whitespace-only q without category", "?q=%20%20%20"],
  ])("returns 400 for %s without calling YouTube", async (_, search) => {
    const response = await get(search);

    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.message).toMatch(/[가-힣]/);
    expect(Object.keys(body)).toEqual(["error"]);
    expect(fetchShortsMock).not.toHaveBeenCalled();
  });

  it.each<[YouTubeErrorCode, number, string]>([
    ["MISSING_API_KEY", 500, ".env.local"],
    ["QUOTA_EXCEEDED", 429, "할당량"],
    ["INVALID_KEY", 502, "YOUTUBE_API_KEY"],
    ["API_NOT_ENABLED", 502, "YouTube Data API v3"],
    ["UPSTREAM_ERROR", 502, "YouTube 응답"],
  ])("maps %s to status %i", async (code, status, hint) => {
    const error = new YouTubeApiError(code, "원본 메시지", 403);
    fetchShortsMock.mockRejectedValue(error);

    const response = await get("?category=quotes&days=7");

    expect(response.status).toBe(status);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe(code);
    expect(body.error.message).toContain(hint);
    expect(Object.keys(body)).toEqual(["error"]);

    expect(consoleError).toHaveBeenCalledTimes(1);
    const logged = consoleError.mock.calls[0];
    expect(logged).not.toContain(error);
    expect(logged.every((arg) => typeof arg === "string")).toBe(true);
    expect(logged.join(" ")).toContain(code);
  });

  it.each<[string, unknown]>([
    ["an Error", new Error("fetch failed https://www.googleapis.com/youtube/v3/search?key=secret-key")],
    ["a non-Error value", "key=secret-key"],
  ])("maps %s to 500 INTERNAL_ERROR without leaking details", async (_, thrown) => {
    fetchShortsMock.mockRejectedValue(thrown);

    const response = await get("?category=quotes&days=7");

    expect(response.status).toBe(500);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe<ApiErrorCode>("INTERNAL_ERROR");
    expect(body.error.message).toMatch(/[가-힣]/);
    expect(JSON.stringify(body)).not.toContain("secret-key");
    expect(JSON.stringify(body)).not.toContain("googleapis");

    expect(consoleError).toHaveBeenCalledTimes(1);
    const logged = consoleError.mock.calls[0];
    expect(logged).not.toContain(thrown);
    expect(logged.every((arg) => typeof arg === "string")).toBe(true);
    expect(logged.join(" ")).toContain("INTERNAL_ERROR");
    expect(logged.join(" ")).not.toContain("secret-key");
  });
});
