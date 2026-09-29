import { describe, expect, it } from "vitest";
import type { ScoredVideo } from "@/types";
import { type KeywordOptions, extractKeywordStats } from "./keywords";

function makeVideo(overrides: Partial<ScoredVideo> = {}): ScoredVideo {
  return {
    id: "vid",
    title: "",
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
    ageDays: 10,
    viewsPerDay: 100,
    engagementRate: 0.05,
    ...overrides,
  };
}

function options(overrides: Partial<KeywordOptions> = {}): KeywordOptions {
  return {
    excludedTerms: new Set(),
    globalMedianViewsPerDay: 100,
    ...overrides,
  };
}

function keywordsOf(videos: ScoredVideo[], overrides?: Partial<KeywordOptions>) {
  return extractKeywordStats(videos, options(overrides)).map((stat) => stat.keyword);
}

describe("extractKeywordStats", () => {
  it("returns an empty array for no videos", () => {
    expect(extractKeywordStats([], options())).toEqual([]);
  });

  it("aggregates a keyword across videos and channels", () => {
    const videos = [
      makeVideo({ id: "v1", channelId: "a", title: "아침루틴", viewsPerDay: 300, engagementRate: 0.25 }),
      makeVideo({ id: "v2", channelId: "b", title: "아침루틴", viewsPerDay: 500, engagementRate: 0.5 }),
      makeVideo({ id: "v3", channelId: "b", title: "아침루틴", viewsPerDay: 100, engagementRate: 0.75 }),
    ];

    // (300 × 3 + 100 × 3) / 6 = 200 → 2
    expect(extractKeywordStats(videos, options())).toEqual([
      {
        keyword: "아침루틴",
        videoCount: 3,
        channelCount: 2,
        medianViewsPerDay: 300,
        avgEngagementRate: 0.5,
        opportunity: 2,
        videoIds: ["v1", "v2", "v3"],
      },
    ]);
  });

  it("counts a keyword once per video even if it repeats in title and tags", () => {
    const videos = [
      makeVideo({ id: "v1", channelId: "a", title: "아침루틴 아침루틴", tags: ["아침루틴"] }),
      makeVideo({ id: "v2", channelId: "b", title: "아침루틴" }),
    ];

    const [stat] = extractKeywordStats(videos, options());

    expect(stat.videoCount).toBe(2);
    expect(stat.videoIds).toEqual(["v1", "v2"]);
  });

  it("counts the same video id only once", () => {
    const video = makeVideo({ id: "v1", channelId: "a", title: "아침루틴" });
    const videos = [video, video, makeVideo({ id: "v2", channelId: "b", title: "아침루틴" })];

    expect(extractKeywordStats(videos, options())[0]).toMatchObject({
      videoCount: 2,
      videoIds: ["v1", "v2"],
    });
  });

  it("drops keywords that appear in only one channel", () => {
    const videos = [
      makeVideo({ id: "v1", channelId: "a", title: "명언 습관" }),
      makeVideo({ id: "v2", channelId: "a", title: "명언 습관" }),
      makeVideo({ id: "v3", channelId: "b", title: "습관" }),
    ];

    expect(keywordsOf(videos)).toEqual(["습관"]);
  });

  it("drops keywords that appear in only one video", () => {
    const videos = [
      makeVideo({ id: "v1", channelId: "a", title: "습관 냉장고" }),
      makeVideo({ id: "v2", channelId: "b", title: "습관" }),
    ];

    expect(keywordsOf(videos)).toEqual(["습관"]);
  });

  it("honors custom minVideos and minChannels", () => {
    const videos = [
      makeVideo({ id: "v1", channelId: "a", title: "명언 습관" }),
      makeVideo({ id: "v2", channelId: "a", title: "명언" }),
      makeVideo({ id: "v3", channelId: "b", title: "습관" }),
    ];

    expect(keywordsOf(videos, { minChannels: 1 })).toEqual(["명언", "습관"]);
    expect(keywordsOf(videos, { minVideos: 3, minChannels: 1 })).toEqual([]);
    expect(keywordsOf(videos, { minVideos: 1, minChannels: 1 })).toEqual([
      "명언",
      "습관",
    ]);
  });

  it("skips excluded terms", () => {
    const videos = [
      makeVideo({ id: "v1", channelId: "a", title: "명언 습관" }),
      makeVideo({ id: "v2", channelId: "b", title: "명언 습관" }),
    ];

    expect(keywordsOf(videos, { excludedTerms: new Set(["명언"]) })).toEqual([
      "습관",
    ]);
  });

  it("uses tags and stripped particles, but not the description", () => {
    const videos = [
      makeVideo({ id: "v1", channelId: "a", title: "습관이 전부", description: "냉장고" }),
      makeVideo({ id: "v2", channelId: "b", title: "작은", tags: ["습관"], description: "냉장고" }),
    ];

    expect(keywordsOf(videos)).toEqual(["습관"]);
  });

  describe("opportunity", () => {
    function opportunityOf(viewsPerDay: number[], global: number): number {
      const videos = viewsPerDay.map((value, index) =>
        makeVideo({ id: `v${index}`, channelId: `c${index}`, title: "습관", viewsPerDay: value }),
      );
      const [stat] = extractKeywordStats(videos, options({ globalMedianViewsPerDay: global }));
      return stat.opportunity;
    }

    it("shrinks the keyword median toward the global median with K = 3", () => {
      // (400 × 2 + 100 × 3) / 5 = 220 → 2.2
      expect(opportunityOf([300, 500], 100)).toBe(2.2);
      // (200 × 3 + 100 × 3) / 6 = 150 → 1.5 (평균 406.7이 아니라 중앙값 200을 쓴다)
      expect(opportunityOf([120, 200, 900], 100)).toBe(1.5);
      // (50 × 2 + 100 × 3) / 5 = 80 → 0.8
      expect(opportunityOf([40, 60], 100)).toBe(0.8);
    });

    it("rounds to two decimals", () => {
      // (400 × 2 + 300 × 3) / 5 = 340 → 340 / 300 = 1.1333…
      expect(opportunityOf([400, 400], 300)).toBe(1.13);
    });

    it("moves closer to the raw ratio as the video count grows", () => {
      const few = opportunityOf([400, 400], 100);
      const many = opportunityOf(Array<number>(12).fill(400), 100);

      expect(few).toBe(2.2);
      expect(many).toBe(3.4);
      expect(many).toBeGreaterThan(few);
    });

    it("is 0 when the global median is 0", () => {
      expect(opportunityOf([300, 500], 0)).toBe(0);
    });
  });

  it("sorts by opportunity, then videoCount, then keyword with < comparison", () => {
    const videos = [
      makeVideo({ id: "v1", channelId: "a", title: "사과 바나나 체리", viewsPerDay: 100 }),
      makeVideo({ id: "v2", channelId: "b", title: "사과 바나나 체리", viewsPerDay: 100 }),
      makeVideo({ id: "v3", channelId: "c", title: "체리", viewsPerDay: 100 }),
      makeVideo({ id: "v4", channelId: "d", title: "딸기 apple", viewsPerDay: 1000 }),
      makeVideo({ id: "v5", channelId: "e", title: "딸기 apple", viewsPerDay: 1000 }),
    ];

    const stats = extractKeywordStats(videos, options());

    // 딸기·apple: 4.6 동점·영상 수 동점 → 'apple' < '딸기'
    // 체리·바나나·사과: 1.0 동점 → 영상 3개인 체리 먼저, 나머지는 '바나나' < '사과'
    expect(stats.map((stat) => [stat.keyword, stat.opportunity, stat.videoCount])).toEqual([
      ["apple", 4.6, 2],
      ["딸기", 4.6, 2],
      ["체리", 1, 3],
      ["바나나", 1, 2],
      ["사과", 1, 2],
    ]);
  });

  it("keeps only the top `limit` keywords (default 20)", () => {
    const words = Array.from({ length: 25 }, (_, i) => `단어${String(i).padStart(2, "0")}`);
    const videos = [
      makeVideo({ id: "v1", channelId: "a", title: words.join(" ") }),
      makeVideo({ id: "v2", channelId: "b", title: words.join(" ") }),
    ];

    expect(keywordsOf(videos)).toEqual(words.slice(0, 20));
    expect(keywordsOf(videos, { limit: 3 })).toEqual(words.slice(0, 3));
  });

  it("returns the same result for the same input", () => {
    const videos = [
      makeVideo({ id: "v1", channelId: "a", title: "습관 명언", viewsPerDay: 300 }),
      makeVideo({ id: "v2", channelId: "b", title: "명언 습관", viewsPerDay: 50 }),
    ];

    expect(extractKeywordStats(videos, options())).toEqual(
      extractKeywordStats(videos, options()),
    );
  });
});
