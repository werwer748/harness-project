import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/lib/categories";
import videosPage from "@/services/__fixtures__/videos-page.json";
import { MAX_SHORT_DURATION_SEC, toShortVideo } from "@/services/youtube";
import type { ShortVideo } from "@/types";
import { type AnalyzeOptions, analyzeShorts } from "./index";
import { toExcludedTerms } from "./tokenize";

const NOW = new Date("2026-09-29T00:00:00Z");
const SEEDS = CATEGORIES["life-tips"].seedKeywords;

// fetchShorts와 같은 규칙으로 라이브·180초 초과·P0D 영상을 뺀다
const FIXTURE_VIDEOS: ShortVideo[] = videosPage.items
  .filter((item) => item.snippet.liveBroadcastContent === "none")
  .map(toShortVideo)
  .filter((video) => video.durationSec >= 1 && video.durationSec <= MAX_SHORT_DURATION_SEC);

const OPTIONS: AnalyzeOptions = {
  scope: "life-tips",
  query: "생활 꿀팁",
  days: 30,
  excludedTerms: toExcludedTerms(SEEDS),
  fallbackKeywords: SEEDS,
  now: NOW,
};

function makeVideo(overrides: Partial<ShortVideo> = {}): ShortVideo {
  return {
    id: "vid",
    title: "제목",
    description: "",
    channelId: "ch",
    channelTitle: "채널",
    publishedAt: "2026-09-19T00:00:00Z",
    thumbnailUrl: "",
    tags: [],
    durationSec: 30,
    viewCount: 1000,
    likeCount: 50,
    commentCount: 10,
    ...overrides,
  };
}

// NaN·Infinity가 있는 숫자 필드의 경로를 모은다
function nonFinitePaths(value: unknown, path = "report"): string[] {
  if (typeof value === "number") return Number.isFinite(value) ? [] : [path];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => nonFinitePaths(item, `${path}[${index}]`));
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      nonFinitePaths(item, `${path}.${key}`),
    );
  }
  return [];
}

describe("nonFinitePaths", () => {
  it("finds NaN and Infinity at any depth", () => {
    expect(nonFinitePaths({ a: 1, b: [2, { c: NaN }], d: { e: Infinity } })).toEqual([
      "report.b[1].c",
      "report.d.e",
    ]);
  });
});

describe("analyzeShorts with the videos-page fixture", () => {
  const report = analyzeShorts(FIXTURE_VIDEOS, OPTIONS);

  it("uses the 7 short videos from the fixture", () => {
    expect(FIXTURE_VIDEOS).toHaveLength(7);
  });

  it("copies the query and stamps generatedAt from `now`", () => {
    expect(report).toMatchObject({
      scope: "life-tips",
      query: "생활 꿀팁",
      days: 30,
      generatedAt: "2026-09-29T00:00:00.000Z",
    });
  });

  it("summarizes the videos", () => {
    expect(report.summary.videoCount).toBe(7);
    expect(report.summary.channelCount).toBe(4);
    expect(report.summary.medianViews).toBe(96000);
    // 냉장고 영상: 254,000회 / 20일 16시간
    expect(report.summary.medianViewsPerDay).toBeCloseTo(12290.32, 2);
    expect(report.summary.avgDurationSec).toBeCloseTo(326 / 7, 10);
    expect(report.summary.avgEngagementRate).toBeGreaterThan(0);
  });

  it("keeps multi-channel keywords ordered by shrunk opportunity", () => {
    expect(
      report.keywords.map((stat) => [stat.keyword, stat.videoCount, stat.channelCount, stat.opportunity]),
    ).toEqual([
      ["아침루틴", 2, 2, 1.29],
      ["습관", 4, 3, 1.18],
      ["자기관리", 2, 2, 1.02],
    ]);
    // 명언·인생·동기부여·자기객관화는 한 채널에서만 나와 빠진다
  });

  it("builds keyword ideas first, then seed fallbacks", () => {
    expect(report.ideas.map((idea) => [idea.keyword, idea.fallback])).toEqual([
      ["아침루틴", false],
      ["습관", false],
      ["자기관리", false],
      ["생활꿀팁", true],
      ["살림 꿀팁", true],
    ]);
    expect(report.ideas[0].referenceVideos.map((video) => video.id)).toEqual([
      "vidMorning2",
      "vidMorning1",
    ]);
    expect(report.ideas[0].reason).toBe(
      "'아침루틴' 쇼츠 2개(채널 2곳)의 일평균 조회수가 전체 중앙값의 1.7배, 평균 참여율 4.8%",
    );
    expect(report.ideas[3].referenceVideos.map((video) => video.id)).toEqual([
      "vidQuote002",
      "vidMorning2",
      "vidMorning1",
    ]);
  });

  it("returns all four title patterns and duration buckets", () => {
    expect(report.titlePatterns.map((stat) => [stat.pattern, stat.videoCount])).toEqual([
      ["number", 3],
      ["question", 2],
      ["howto", 1],
      ["short-title", 3],
    ]);
    expect(report.durationBuckets.map((stat) => [stat.bucket, stat.videoCount])).toEqual([
      ["0-15", 0],
      ["16-30", 1],
      ["31-60", 5],
      ["61-180", 1],
    ]);
  });

  it("sorts topVideos by viewsPerDay", () => {
    expect(report.topVideos.map((video) => video.id)).toEqual([
      "vidQuote002",
      "vidMorning2",
      "vidMorning1",
      "vidFridge01",
      "vidQuote001",
      "vidNoLike01",
      "vidSelf0001",
    ]);
  });

  it("returns an equal report for the same input", () => {
    expect(analyzeShorts(FIXTURE_VIDEOS, OPTIONS)).toEqual(analyzeShorts(FIXTURE_VIDEOS, OPTIONS));
  });

  it("does not mutate the input videos", () => {
    const videos = structuredClone(FIXTURE_VIDEOS);
    analyzeShorts(videos, OPTIONS);
    expect(videos).toEqual(FIXTURE_VIDEOS);
  });

  it("has only finite numbers and survives a JSON round trip", () => {
    expect(nonFinitePaths(report)).toEqual([]);
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });
});

describe("analyzeShorts edge cases", () => {
  it("returns an empty report without throwing for no videos", () => {
    const report = analyzeShorts([], OPTIONS);

    expect(report.summary).toEqual({
      videoCount: 0,
      channelCount: 0,
      medianViews: 0,
      medianViewsPerDay: 0,
      avgEngagementRate: 0,
      avgDurationSec: 0,
    });
    expect(report.keywords).toEqual([]);
    expect(report.topVideos).toEqual([]);
    expect(report.titlePatterns).toHaveLength(4);
    expect(report.durationBuckets).toHaveLength(4);
    for (const stat of [...report.titlePatterns, ...report.durationBuckets]) {
      expect(stat).toMatchObject({ videoCount: 0, share: 0, medianViewsPerDay: 0 });
    }
    expect(report.ideas.map((idea) => idea.keyword)).toEqual(SEEDS);
    for (const idea of report.ideas) {
      expect(idea).toMatchObject({ fallback: true, opportunity: 0, referenceVideos: [] });
    }
    expect(nonFinitePaths(report)).toEqual([]);
  });

  it("uses the custom query as the only fallback keyword", () => {
    const report = analyzeShorts([], {
      ...OPTIONS,
      scope: "custom",
      query: "아침 루틴",
      excludedTerms: toExcludedTerms(["아침 루틴"]),
      fallbackKeywords: ["아침 루틴"],
    });

    expect(report.ideas.map((idea) => [idea.scope, idea.keyword, idea.fallback])).toEqual([
      ["custom", "아침 루틴", true],
    ]);
  });

  it("keeps numbers finite for zero views, future and invalid dates", () => {
    const videos = [
      makeVideo({ id: "a", viewCount: 0, likeCount: 0, commentCount: 0 }),
      makeVideo({ id: "b", viewCount: 0, likeCount: 5, publishedAt: "2027-01-01T00:00:00Z" }),
      makeVideo({ id: "c", viewCount: 0, publishedAt: "invalid" }),
    ];

    const report = analyzeShorts(videos, OPTIONS);

    expect(nonFinitePaths(report)).toEqual([]);
    expect(report.summary.medianViewsPerDay).toBe(0);
    expect(report.titlePatterns.every((stat) => stat.lift === 0)).toBe(true);
  });

  it("keeps the top 20 videos, breaking viewsPerDay ties by id", () => {
    const videos = Array.from({ length: 25 }, (_, index) =>
      makeVideo({ id: `v${String(index).padStart(2, "0")}`, viewCount: (index % 5) * 100 }),
    );

    const { topVideos } = analyzeShorts(videos, OPTIONS);

    expect(topVideos).toHaveLength(20);
    expect(topVideos.slice(0, 6).map((video) => video.id)).toEqual([
      "v04",
      "v09",
      "v14",
      "v19",
      "v24",
      "v03",
    ]);
    for (let i = 1; i < topVideos.length; i += 1) {
      expect(topVideos[i - 1].viewsPerDay).toBeGreaterThanOrEqual(topVideos[i].viewsPerDay);
    }
  });
});
