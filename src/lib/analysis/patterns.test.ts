import { describe, expect, it } from "vitest";
import type { ScoredVideo, TitlePattern } from "@/types";
import { analyzeDurationBuckets, analyzeTitlePatterns } from "./patterns";

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

function patternsOf(title: string): TitlePattern[] {
  return analyzeTitlePatterns([makeVideo({ title })])
    .filter((stat) => stat.videoCount === 1)
    .map((stat) => stat.pattern);
}

describe("analyzeTitlePatterns", () => {
  it("always returns the four patterns in a fixed order with Korean labels", () => {
    expect(analyzeTitlePatterns([])).toEqual([
      { pattern: "number", label: "숫자 포함", videoCount: 0, share: 0, medianViewsPerDay: 0, lift: 0 },
      { pattern: "question", label: "질문형", videoCount: 0, share: 0, medianViewsPerDay: 0, lift: 0 },
      { pattern: "howto", label: "방법·꿀팁형", videoCount: 0, share: 0, medianViewsPerDay: 0, lift: 0 },
      { pattern: "short-title", label: "20자 이하 짧은 제목", videoCount: 0, share: 0, medianViewsPerDay: 0, lift: 0 },
    ]);
  });

  it.each<[string, TitlePattern[]]>([
    ["냉장고 정리하는 방법 #살림꿀팁", ["howto", "short-title"]],
    ["아침루틴 3가지만 바꿔도 하루가 달라져요 #shorts", ["number"]],
    ["자취생 아침루틴, 10분이면 충분할까?", ["number", "question"]],
    ["자기객관화 안 되는 사람 특징 #shorts", ["short-title"]],
    ["습관이 인생을 바꾼다 | 동기부여 명언", []],
  ])("classifies fixture title %s", (title, expected) => {
    expect(patternsOf(title)).toEqual(expected);
  });

  describe("number", () => {
    it("matches any digit in the title", () => {
      expect(patternsOf("하루 1분이면 충분한 스트레칭 루틴 모음집")).toContain("number");
      expect(patternsOf("하루 한 번이면 충분한 스트레칭 루틴 모음집")).not.toContain("number");
    });
  });

  describe("question", () => {
    it.each([
      "진짜? 이게 된다고요 그럼 다들 알고 있었던 건가",
      "왜 다들 이걸 모를까",
      "이렇게 하면 되나요",
      "우리는 왜 불안해지는가",
      "왜 다들 이걸 모를까 #shorts #tip",
      "이렇게 하면 되나요   ",
    ])("detects %s", (title) => {
      expect(patternsOf(title)).toContain("question");
    });

    it.each([
      "까다로운 사람 대처하기",
      "모를까 봐 정리했습니다",
      "이게 인생이다",
    ])("does not detect %s", (title) => {
      expect(patternsOf(title)).not.toContain("question");
    });
  });

  describe("howto", () => {
    it.each(["냉장고 정리 방법", "빨래 개는 법 말고 빨래 하는 법", "빨래하는법", "자취 꿀팁", "살림 노하우"])(
      "detects %s",
      (title) => {
        expect(patternsOf(title)).toContain("howto");
      },
    );

    it("does not detect titles without the phrases", () => {
      expect(patternsOf("빨래 개는 법")).not.toContain("howto");
    });
  });

  describe("short-title", () => {
    it("counts 20 characters or fewer after removing hashtags", () => {
      expect(patternsOf("가".repeat(20))).toContain("short-title");
      expect(patternsOf("가".repeat(21))).not.toContain("short-title");
      expect(patternsOf(`${"가".repeat(20)} #shorts #자취꿀팁`)).toContain("short-title");
      expect(patternsOf(`#shorts ${"가".repeat(20)}`)).toContain("short-title");
    });

    it("counts NFD hangul as composed characters", () => {
      expect(patternsOf("가".repeat(20).normalize("NFD"))).toContain("short-title");
    });
  });

  it("computes share, median and lift against all videos", () => {
    const videos = [
      makeVideo({ id: "v1", title: "첫 번째 제목입니다 하지만 스물한 글자를 넘깁니다", viewsPerDay: 100 }),
      makeVideo({ id: "v2", title: "두 번째 제목입니다 하지만 스물한 글자를 넘깁니다", viewsPerDay: 200 }),
      makeVideo({ id: "v3", title: "3번째 제목입니다 하지만 스물한 글자를 넘깁니다", viewsPerDay: 300 }),
      makeVideo({ id: "v4", title: "4번째 제목입니다 하지만 스물한 글자를 넘깁니다", viewsPerDay: 400 }),
    ];

    const [number, question] = analyzeTitlePatterns(videos);

    // 전체 중앙값 250, 숫자 포함 중앙값 350
    expect(number).toEqual({
      pattern: "number",
      label: "숫자 포함",
      videoCount: 2,
      share: 0.5,
      medianViewsPerDay: 350,
      lift: 1.4,
    });
    expect(question).toMatchObject({ videoCount: 0, share: 0, medianViewsPerDay: 0, lift: 0 });
  });

  it("returns lift 0 when the overall median is 0", () => {
    const [number] = analyzeTitlePatterns([makeVideo({ title: "1분", viewsPerDay: 0 })]);

    expect(number).toMatchObject({ videoCount: 1, share: 1, lift: 0 });
  });
});

describe("analyzeDurationBuckets", () => {
  it("always returns the four buckets in a fixed order with Korean labels", () => {
    expect(analyzeDurationBuckets([])).toEqual([
      { bucket: "0-15", label: "15초 이하", videoCount: 0, share: 0, medianViewsPerDay: 0 },
      { bucket: "16-30", label: "16–30초", videoCount: 0, share: 0, medianViewsPerDay: 0 },
      { bucket: "31-60", label: "31–60초", videoCount: 0, share: 0, medianViewsPerDay: 0 },
      { bucket: "61-180", label: "61초–3분", videoCount: 0, share: 0, medianViewsPerDay: 0 },
    ]);
  });

  it("puts boundary durations into the right bucket", () => {
    const durations = [1, 15, 16, 30, 31, 60, 61, 180];
    const videos = durations.map((durationSec, index) =>
      makeVideo({ id: `v${index}`, durationSec, viewsPerDay: durationSec }),
    );

    expect(analyzeDurationBuckets(videos)).toEqual([
      { bucket: "0-15", label: "15초 이하", videoCount: 2, share: 0.25, medianViewsPerDay: 8 },
      { bucket: "16-30", label: "16–30초", videoCount: 2, share: 0.25, medianViewsPerDay: 23 },
      { bucket: "31-60", label: "31–60초", videoCount: 2, share: 0.25, medianViewsPerDay: 45.5 },
      { bucket: "61-180", label: "61초–3분", videoCount: 2, share: 0.25, medianViewsPerDay: 120.5 },
    ]);
  });
});
