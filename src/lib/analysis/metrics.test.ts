import { describe, expect, it } from "vitest";
import type { ShortVideo } from "@/types";
import {
  average,
  compareByViewsPerDay,
  computeMetrics,
  median,
  scoreVideos,
} from "./metrics";

const NOW = new Date("2026-09-29T00:00:00Z");

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

describe("median", () => {
  it("returns 0 for an empty array", () => {
    expect(median([])).toBe(0);
  });

  it("returns the middle value for an odd count", () => {
    expect(median([5])).toBe(5);
    expect(median([3, 1, 2])).toBe(2);
  });

  it("averages the two middle values for an even count", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([10, 20])).toBe(15);
  });

  it("does not mutate the input", () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe("average", () => {
  it("returns 0 for an empty array", () => {
    expect(average([])).toBe(0);
  });

  it("returns the arithmetic mean", () => {
    expect(average([1, 2, 6])).toBe(3);
  });
});

describe("computeMetrics", () => {
  it("divides views by age in days", () => {
    expect(computeMetrics(makeVideo(), NOW)).toEqual({
      ageDays: 10,
      viewsPerDay: 100,
      engagementRate: 0.06,
    });
  });

  it("keeps fractional days", () => {
    const video = makeVideo({ publishedAt: "2026-09-26T12:00:00Z", viewCount: 250 });
    expect(computeMetrics(video, NOW)).toMatchObject({ ageDays: 2.5, viewsPerDay: 100 });
  });

  it("floors age at 1 day for videos younger than a day", () => {
    const video = makeVideo({ publishedAt: "2026-09-28T18:00:00Z", viewCount: 900 });
    expect(computeMetrics(video, NOW)).toMatchObject({ ageDays: 1, viewsPerDay: 900 });
  });

  it("treats future and invalid dates as 1 day old", () => {
    for (const publishedAt of ["2026-10-05T00:00:00Z", "", "not-a-date"]) {
      const metrics = computeMetrics(makeVideo({ publishedAt, viewCount: 700 }), NOW);
      expect(metrics).toMatchObject({ ageDays: 1, viewsPerDay: 700 });
    }
  });

  it("divides by 1 instead of 0 when a video has no views", () => {
    const silent = makeVideo({ viewCount: 0, likeCount: 0, commentCount: 0 });
    expect(computeMetrics(silent, NOW)).toEqual({
      ageDays: 10,
      viewsPerDay: 0,
      engagementRate: 0,
    });

    const oddCounts = makeVideo({ viewCount: 0, likeCount: 3, commentCount: 2 });
    expect(computeMetrics(oddCounts, NOW).engagementRate).toBe(5);
  });
});

describe("scoreVideos", () => {
  it("adds metrics to every video and keeps the input order", () => {
    const videos = [
      makeVideo({ id: "b", viewCount: 500 }),
      makeVideo({ id: "a", viewCount: 2000 }),
    ];

    const scored = scoreVideos(videos, NOW);

    expect(scored.map((video) => video.id)).toEqual(["b", "a"]);
    expect(scored[0]).toEqual({
      ...videos[0],
      ageDays: 10,
      viewsPerDay: 50,
      engagementRate: 0.12,
    });
    expect(scored[1].viewsPerDay).toBe(200);
  });

  it("returns an empty array for no videos", () => {
    expect(scoreVideos([], NOW)).toEqual([]);
  });
});

describe("compareByViewsPerDay", () => {
  it("sorts by viewsPerDay descending, then id ascending", () => {
    const videos = [
      { id: "c", viewsPerDay: 10 },
      { id: "b", viewsPerDay: 30 },
      { id: "a", viewsPerDay: 10 },
      { id: "d", viewsPerDay: 20 },
    ];

    expect([...videos].sort(compareByViewsPerDay).map((video) => video.id)).toEqual([
      "b",
      "d",
      "a",
      "c",
    ]);
  });
});
