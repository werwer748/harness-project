import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import errorKeyInvalid from "./__fixtures__/error-key-invalid.json";
import errorNotEnabled from "./__fixtures__/error-not-enabled.json";
import errorQuota from "./__fixtures__/error-quota.json";
import searchPage from "./__fixtures__/search-page.json";
import videosPage from "./__fixtures__/videos-page.json";
import {
  type FetchShortsOptions,
  MAX_SHORT_DURATION_SEC,
  YouTubeApiError,
  type YouTubeErrorCode,
  fetchShorts,
  toShortVideo,
} from "./youtube";

const NOW = new Date("2026-09-29T00:00:00Z");
const API_KEY = "test-key";
const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

// search-page.json 순서에서 180초 초과·라이브·P0D 영상을 뺀 것
const SHORT_IDS = [
  "vidFridge01",
  "vidMorning1",
  "vidQuote001",
  "vidMorning2",
  "vidSelf0001",
  "vidQuote002",
  "vidNoLike01",
];

type FetchMock = ReturnType<typeof mockFetch>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetch(handler: (url: URL) => Response | Promise<Response>) {
  const fetchMock = vi.fn<typeof fetch>(async (input) =>
    handler(new URL(String(input))),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// videos.list는 요청한 id 순서대로 fixture 영상을 돌려준다
function mockFixtureFetch() {
  return mockFetch((url) => {
    if (endpointOf(url) === SEARCH_URL) return jsonResponse(searchPage);
    const ids = url.searchParams.get("id")?.split(",") ?? [];
    return jsonResponse({
      ...videosPage,
      items: ids.flatMap((id) =>
        videosPage.items.filter((item) => item.id === id),
      ),
    });
  });
}

function endpointOf(url: URL): string {
  return `${url.origin}${url.pathname}`;
}

function requestedUrls(fetchMock: FetchMock, endpoint?: string): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input)))
    .filter((url) => endpoint === undefined || endpointOf(url) === endpoint);
}

function run(overrides: Partial<FetchShortsOptions> = {}) {
  return fetchShorts({ queries: ["아침루틴"], days: 7, now: NOW, ...overrides });
}

async function captureError(promise: Promise<unknown>): Promise<YouTubeApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(YouTubeApiError);
    return error as YouTubeApiError;
  }
  throw new Error("fetchShorts가 reject되지 않았습니다");
}

beforeEach(() => {
  vi.stubEnv("YOUTUBE_API_KEY", API_KEY);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("MAX_SHORT_DURATION_SEC", () => {
  it("is 180", () => {
    expect(MAX_SHORT_DURATION_SEC).toBe(180);
  });
});

describe("fetchShorts — API key", () => {
  it.each([[""], ["   "], [undefined]])(
    "throws MISSING_API_KEY without fetching when the key is %j",
    async (value) => {
      vi.stubEnv("YOUTUBE_API_KEY", value);
      const fetchMock = mockFixtureFetch();

      const error = await captureError(run());

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("YouTubeApiError");
      expect(error.code).toBe("MISSING_API_KEY");
      expect(error.message).not.toBe("");
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("reads the key at call time and trims it", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", `  ${API_KEY}  `);
    const fetchMock = mockFixtureFetch();

    await run();

    const urls = requestedUrls(fetchMock);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url.searchParams.get("key")).toBe(API_KEY);
    }
  });
});

describe("fetchShorts — requests", () => {
  it("calls search.list with the required parameters and no pageToken", async () => {
    const fetchMock = mockFixtureFetch();

    await run({ queries: ["아침 루틴"], days: 7 });

    const [search] = requestedUrls(fetchMock, SEARCH_URL);
    expect(Object.fromEntries(search.searchParams)).toEqual({
      part: "snippet",
      type: "video",
      videoDuration: "short",
      regionCode: "KR",
      relevanceLanguage: "ko",
      order: "viewCount",
      maxResults: "25",
      q: "아침 루틴",
      publishedAfter: "2026-09-22T00:00:00Z",
      key: API_KEY,
    });
  });

  it.each([
    [7, "2026-09-22T08:15:30Z"],
    [30, "2026-08-30T08:15:30Z"],
    [90, "2026-07-01T08:15:30Z"],
  ])(
    "sets publishedAfter to now minus %i days without milliseconds",
    async (days, expected) => {
      const fetchMock = mockFixtureFetch();

      await run({ days, now: new Date("2026-09-29T08:15:30.456Z") });

      const [search] = requestedUrls(fetchMock, SEARCH_URL);
      expect(search.searchParams.get("publishedAfter")).toBe(expected);
    },
  );

  it("uses maxResultsPerQuery when given", async () => {
    const fetchMock = mockFixtureFetch();

    await run({ maxResultsPerQuery: 10 });

    const [search] = requestedUrls(fetchMock, SEARCH_URL);
    expect(search.searchParams.get("maxResults")).toBe("10");
  });

  it("passes { next: { revalidate: 600 } } to every fetch", async () => {
    const fetchMock = mockFixtureFetch();

    await run({ queries: ["생활꿀팁", "살림 꿀팁"] });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toEqual({ next: { revalidate: 600 } });
    }
  });

  it("searches once per query, dedupes ids, then calls videos.list", async () => {
    const fetchMock = mockFixtureFetch();
    const queries = ["생활꿀팁", "살림 꿀팁", "자취 꿀팁"];

    await run({ queries });

    const searches = requestedUrls(fetchMock, SEARCH_URL);
    expect(searches.map((url) => url.searchParams.get("q"))).toEqual(queries);

    const videos = requestedUrls(fetchMock, VIDEOS_URL);
    expect(videos).toHaveLength(1);
    expect(videos[0].searchParams.get("part")).toBe(
      "snippet,statistics,contentDetails",
    );
    expect(videos[0].searchParams.get("key")).toBe(API_KEY);
    expect(videos[0].searchParams.get("id")).toBe(
      searchPage.items.map((item) => item.id.videoId).join(","),
    );
  });

  it("splits videos.list into batches of 50 in first-seen order", async () => {
    // 쿼리 k는 id{20k}..id{20k+24}를 돌려준다 → 겹치는 5개씩 제거하면 65개
    const fetchMock = mockFetch((url) => {
      if (endpointOf(url) === VIDEOS_URL) return jsonResponse({ items: [] });
      const offset = Number(url.searchParams.get("q")) * 20;
      return jsonResponse({
        items: Array.from({ length: 25 }, (_, n) => ({
          id: { kind: "youtube#video", videoId: `id${offset + n}` },
        })),
      });
    });

    await run({ queries: ["0", "1", "2"] });

    const ids = Array.from({ length: 65 }, (_, n) => `id${n}`);
    const batches = requestedUrls(fetchMock, VIDEOS_URL).map((url) =>
      url.searchParams.get("id")?.split(","),
    );
    expect(batches).toEqual([ids.slice(0, 50), ids.slice(50)]);
  });

  it("ignores search items without a videoId", async () => {
    const fetchMock = mockFetch((url) =>
      endpointOf(url) === SEARCH_URL
        ? jsonResponse({
            items: [
              { id: { kind: "youtube#channel", channelId: "UCsalimharu" } },
              { id: { kind: "youtube#video", videoId: "vidMorning1" } },
            ],
          })
        : jsonResponse({ items: [] }),
    );

    await run();

    const [videos] = requestedUrls(fetchMock, VIDEOS_URL);
    expect(videos.searchParams.get("id")).toBe("vidMorning1");
  });

  it("returns [] without calling videos.list when search finds nothing", async () => {
    const fetchMock = mockFetch(() => jsonResponse({ items: [] }));

    await expect(run()).resolves.toEqual([]);
    expect(requestedUrls(fetchMock, VIDEOS_URL)).toHaveLength(0);
  });
});

describe("fetchShorts — mapping and filtering", () => {
  it("keeps only non-live videos between 1 and 180 seconds", async () => {
    mockFixtureFetch();

    const videos = await run();

    expect(videos.map((video) => video.id)).toEqual(SHORT_IDS);
    for (const video of videos) {
      expect(video.durationSec).toBeGreaterThanOrEqual(1);
      expect(video.durationSec).toBeLessThanOrEqual(MAX_SHORT_DURATION_SEC);
    }
  });

  it("maps a videos.list item to ShortVideo", async () => {
    mockFixtureFetch();

    const videos = await run();

    expect(videos.find((video) => video.id === "vidMorning1")).toEqual({
      id: "vidMorning1",
      title: "아침루틴 3가지만 바꿔도 하루가 달라져요 #shorts",
      description: "매일 아침 5분 투자로 달라지는 하루 #아침루틴 #자기관리",
      channelId: "UCsalimharu",
      channelTitle: "살림하는 하루",
      publishedAt: "2026-09-20T09:00:00Z",
      thumbnailUrl: "https://i.ytimg.com/vi/vidMorning1/hqdefault.jpg",
      tags: ["아침루틴", "자기관리", "생활꿀팁"],
      durationSec: 45,
      viewCount: 182000,
      likeCount: 9100,
      commentCount: 320,
    });
  });

  it("uses the unescaped videos.list title, not the search title", async () => {
    mockFixtureFetch();

    const videos = await run();

    expect(videos.find((video) => video.id === "vidQuote001")?.title).toBe(
      '힘들 때 듣는 "인생 명언" 한 줄',
    );
  });

  it("defaults a missing likeCount to 0", async () => {
    mockFixtureFetch();

    const videos = await run();

    expect(videos.find((video) => video.id === "vidNoLike01")).toMatchObject({
      viewCount: 52000,
      likeCount: 0,
      commentCount: 180,
    });
  });
});

describe("toShortVideo", () => {
  it("fills defaults for missing fields", () => {
    expect(toShortVideo({ id: "bare" })).toEqual({
      id: "bare",
      title: "",
      description: "",
      channelId: "",
      channelTitle: "",
      publishedAt: "",
      thumbnailUrl: "",
      tags: [],
      durationSec: 0,
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
    });
  });

  it("treats non-numeric counts as 0", () => {
    const video = toShortVideo({
      id: "counts",
      statistics: { viewCount: "abc", likeCount: "", commentCount: "12" },
    });

    expect(video).toMatchObject({ viewCount: 0, likeCount: 0, commentCount: 12 });
  });

  it.each([
    ["high", { high: { url: "h" }, medium: { url: "m" }, default: { url: "d" } }, "h"],
    ["medium", { medium: { url: "m" }, default: { url: "d" } }, "m"],
    ["default", { default: { url: "d" } }, "d"],
    ["none", {}, ""],
  ])("picks the %s thumbnail first", (_name, thumbnails, expected) => {
    expect(toShortVideo({ id: "thumb", snippet: { thumbnails } }).thumbnailUrl).toBe(
      expected,
    );
  });
});

describe("fetchShorts — errors", () => {
  it.each<[string, unknown, number, YouTubeErrorCode]>([
    ["error-quota", errorQuota, 403, "QUOTA_EXCEEDED"],
    ["error-key-invalid", errorKeyInvalid, 400, "INVALID_KEY"],
    ["error-not-enabled", errorNotEnabled, 403, "API_NOT_ENABLED"],
  ])("maps the %s fixture to its code", async (_name, body, status, code) => {
    mockFetch(() => jsonResponse(body, status));

    const error = await captureError(run());

    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
  });

  it.each<[unknown, YouTubeErrorCode]>([
    [{ error: { errors: [{ reason: "quotaExceeded" }] } }, "QUOTA_EXCEEDED"],
    [{ error: { errors: [{ reason: "dailyLimitExceeded" }] } }, "QUOTA_EXCEEDED"],
    [{ error: { errors: [{ reason: "rateLimitExceeded" }] } }, "QUOTA_EXCEEDED"],
    [{ error: { errors: [{ reason: "keyInvalid" }] } }, "INVALID_KEY"],
    [{ error: { details: [{ reason: "API_KEY_INVALID" }] } }, "INVALID_KEY"],
    [{ error: { errors: [{ reason: "accessNotConfigured" }] } }, "API_NOT_ENABLED"],
    [{ error: { details: [{ reason: "SERVICE_DISABLED" }] } }, "API_NOT_ENABLED"],
  ])("maps %j to %s", async (body, code) => {
    mockFetch(() => jsonResponse(body, 403));

    expect((await captureError(run())).code).toBe(code);
  });

  it("maps errors from videos.list as well", async () => {
    mockFetch((url) =>
      endpointOf(url) === SEARCH_URL
        ? jsonResponse(searchPage)
        : jsonResponse(errorQuota, 403),
    );

    expect((await captureError(run())).code).toBe("QUOTA_EXCEEDED");
  });

  it.each<[string, () => Response]>([
    [
      "an unknown reason with 403",
      () => jsonResponse({ error: { code: 403, errors: [{ reason: "forbidden" }] } }, 403),
    ],
    [
      "a 500 without reasons",
      () => jsonResponse({ error: { code: 500, message: "Backend Error" } }, 500),
    ],
    ["a non-JSON error body", () => new Response("<html>Bad Gateway</html>", { status: 502 })],
    ["a non-JSON success body", () => new Response("not json", { status: 200 })],
  ])("maps %s to UPSTREAM_ERROR", async (_name, respond) => {
    mockFetch(respond);

    expect((await captureError(run())).code).toBe("UPSTREAM_ERROR");
  });

  it("maps network failures to UPSTREAM_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    const error = await captureError(run());

    expect(error.code).toBe("UPSTREAM_ERROR");
    expect(error.status).toBeUndefined();
  });

  it("never puts the API key or request URL in errors or logs", async () => {
    const consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map(
      (method) => vi.spyOn(console, method).mockImplementation(() => {}),
    );
    const scenarios: (() => Promise<Response>)[] = [
      async () => jsonResponse(errorQuota, 403),
      async () => jsonResponse(errorKeyInvalid, 400),
      async () => jsonResponse(errorNotEnabled, 403),
      async () => jsonResponse({ error: { message: `bad key=${API_KEY}` } }, 500),
      async () => {
        throw new TypeError(`fetch failed: ${SEARCH_URL}?key=${API_KEY}`);
      },
    ];

    for (const scenario of scenarios) {
      vi.stubGlobal("fetch", vi.fn(scenario));

      const error = await captureError(run());

      expect(error.message).not.toBe("");
      expect(error.cause).toBeUndefined();
      for (const text of [error.message, String(error), JSON.stringify(error)]) {
        expect(text).not.toContain(API_KEY);
        expect(text).not.toContain("googleapis.com");
      }
    }

    const logged = consoleSpies
      .flatMap((spy) => spy.mock.calls.flat())
      .map(String)
      .join("\n");
    expect(logged).not.toContain(API_KEY);
  });
});
