import { describe, expect, it } from "vitest";
import { CATEGORIES, CUSTOM_TEMPLATES } from "@/lib/categories";
import type { KeywordStat, ScoredVideo, TemplateSet } from "@/types";
import { type BuildIdeasInput, buildIdeas, stableHash } from "./recommend";

const FALLBACK_REASON = "수집된 데이터가 부족해 기본 주제로 제안합니다";

function makeVideo(overrides: Partial<ScoredVideo> = {}): ScoredVideo {
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
    ageDays: 10,
    viewsPerDay: 100,
    engagementRate: 0.05,
    ...overrides,
  };
}

function makeStat(overrides: Partial<KeywordStat> = {}): KeywordStat {
  return {
    keyword: "키워드",
    videoCount: 2,
    channelCount: 2,
    medianViewsPerDay: 100,
    avgEngagementRate: 0.05,
    opportunity: 1,
    videoIds: [],
    ...overrides,
  };
}

function input(overrides: Partial<BuildIdeasInput> = {}): BuildIdeasInput {
  return {
    scope: "life-tips",
    keywords: [],
    videos: [],
    fallbackKeywords: [],
    ...overrides,
  };
}

function expectedTemplates(templates: TemplateSet, keyword: string) {
  const h = stableHash(keyword);
  const { titleTemplates, hookTemplates } = templates;
  const titleTemplate = (i: number) => titleTemplates[(h + i) % titleTemplates.length];

  return {
    titles: [0, 1, 2].map((i) => titleTemplate(i).text.split("{keyword}").join(keyword)),
    hook: hookTemplates[h % hookTemplates.length].split("{keyword}").join(keyword),
    templateKey: titleTemplate(0).key,
  };
}

// 전체 viewsPerDay 중앙값 100, '아침루틴' 영상 4개의 중앙값 180
const VIDEOS = [
  makeVideo({ id: "k1", channelId: "a", title: "아침루틴 하나", viewsPerDay: 100 }),
  makeVideo({ id: "k2", channelId: "b", title: "아침루틴 둘", viewsPerDay: 160 }),
  makeVideo({ id: "k3", channelId: "c", title: "아침루틴 셋", viewsPerDay: 200 }),
  makeVideo({ id: "k4", channelId: "a", title: "아침루틴 넷", viewsPerDay: 250 }),
  makeVideo({ id: "o1", channelId: "d", title: "기타 하나", viewsPerDay: 10 }),
  makeVideo({ id: "o2", channelId: "d", title: "기타 둘", viewsPerDay: 20 }),
  makeVideo({ id: "o3", channelId: "d", title: "기타 셋", viewsPerDay: 30 }),
];

const MORNING = makeStat({
  keyword: "아침루틴",
  videoCount: 4,
  channelCount: 3,
  medianViewsPerDay: 180,
  avgEngagementRate: 0.042,
  opportunity: 1.37,
  videoIds: ["k1", "k2", "k3", "k4"],
});

describe("stableHash", () => {
  it("implements 32-bit FNV-1a", () => {
    expect(stableHash("")).toBe(0x811c9dc5);
    expect(stableHash("a")).toBe(0xe40c292c);
  });

  it("returns the same non-negative integer for the same text", () => {
    for (const text of ["아침루틴", "명언", "self reflection", "🔥"]) {
      const hash = stableHash(text);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
      expect(stableHash(text)).toBe(hash);
    }
  });

  it("differs for different text", () => {
    expect(stableHash("아침루틴")).not.toBe(stableHash("저녁루틴"));
  });
});

describe("buildIdeas", () => {
  it("builds a keyword idea from the category templates", () => {
    const [idea] = buildIdeas(input({ keywords: [MORNING], videos: VIDEOS }));
    const expected = expectedTemplates(CATEGORIES["life-tips"], "아침루틴");

    expect(idea).toEqual({
      id: `life-tips:아침루틴:${expected.templateKey}`,
      scope: "life-tips",
      keyword: "아침루틴",
      titles: expected.titles,
      hook: expected.hook,
      reason:
        "'아침루틴' 쇼츠 4개(채널 3곳)의 일평균 조회수가 전체 중앙값의 1.8배, 평균 참여율 4.2%",
      opportunity: 1.37,
      referenceVideos: [
        { id: "k4", title: "아침루틴 넷", channelTitle: "채널", viewCount: 1000, viewsPerDay: 250 },
        { id: "k3", title: "아침루틴 셋", channelTitle: "채널", viewCount: 1000, viewsPerDay: 200 },
        { id: "k2", title: "아침루틴 둘", channelTitle: "채널", viewCount: 1000, viewsPerDay: 160 },
      ],
      fallback: false,
    });
  });

  it("uses three different title templates and fills in every {keyword}", () => {
    for (const scope of ["life-tips", "quotes", "self-reflection", "custom"] as const) {
      const [idea] = buildIdeas(input({ scope, keywords: [MORNING], videos: VIDEOS }));

      expect(idea.titles).toHaveLength(3);
      expect(new Set(idea.titles).size).toBe(3);
      for (const text of [...idea.titles, idea.hook]) {
        expect(text).toContain("아침루틴");
        expect(text).not.toContain("{keyword}");
      }
    }
  });

  it("uses the custom templates for the custom scope", () => {
    const [idea] = buildIdeas(input({ scope: "custom", keywords: [MORNING], videos: VIDEOS }));
    const expected = expectedTemplates(CUSTOM_TEMPLATES, "아침루틴");

    expect(idea.id).toBe(`custom:아침루틴:${expected.templateKey}`);
    expect(idea.titles).toEqual(expected.titles);
    expect(idea.hook).toBe(expected.hook);
  });

  it("inserts keywords literally, even with $ patterns", () => {
    const [idea] = buildIdeas(input({ scope: "custom", fallbackKeywords: ["$& 재테크"] }));

    for (const text of [...idea.titles, idea.hook]) {
      expect(text).toContain("$& 재테크");
    }
  });

  it("breaks reference video ties by id", () => {
    const videos = [
      makeVideo({ id: "b", viewsPerDay: 50 }),
      makeVideo({ id: "c", viewsPerDay: 90 }),
      makeVideo({ id: "a", viewsPerDay: 50 }),
      makeVideo({ id: "d", viewsPerDay: 50 }),
    ];
    const stat = makeStat({ videoIds: ["b", "c", "a", "d"] });

    const [idea] = buildIdeas(input({ keywords: [stat], videos }));

    expect(idea.referenceVideos.map((video) => video.id)).toEqual(["c", "a", "b"]);
  });

  it("builds `count` ideas from the top keywords (default 5)", () => {
    const keywords = ["가", "나", "다", "라", "마", "바", "사"].map((syllable, index) =>
      makeStat({ keyword: `${syllable}${syllable}`, opportunity: 3 - index * 0.1 }),
    );

    const ideas = buildIdeas(input({ keywords, fallbackKeywords: ["생활꿀팁"] }));

    expect(ideas.map((idea) => idea.keyword)).toEqual(["가가", "나나", "다다", "라라", "마마"]);
    expect(ideas.every((idea) => !idea.fallback)).toBe(true);
    expect(buildIdeas(input({ keywords, count: 2 }))).toHaveLength(2);
  });

  it("fills missing ideas with fallback keywords and skips duplicates", () => {
    const videos = [
      makeVideo({ id: "v1", viewsPerDay: 10 }),
      makeVideo({ id: "v2", viewsPerDay: 40 }),
      makeVideo({ id: "v3", viewsPerDay: 30 }),
      makeVideo({ id: "v4", viewsPerDay: 20 }),
    ];
    const stat = makeStat({ keyword: "아침루틴", videoIds: ["v1"] });

    const ideas = buildIdeas(
      input({
        keywords: [stat],
        videos,
        fallbackKeywords: ["아침루틴", "명언", "명언", "인생 명언"],
      }),
    );

    expect(ideas.map((idea) => [idea.keyword, idea.fallback])).toEqual([
      ["아침루틴", false],
      ["명언", true],
      ["인생 명언", true],
    ]);
    for (const idea of ideas.slice(1)) {
      expect(idea.opportunity).toBe(0);
      expect(idea.reason).toBe(FALLBACK_REASON);
      expect(idea.referenceVideos.map((video) => video.id)).toEqual(["v2", "v3", "v4"]);
    }
    expect(new Set(ideas.map((idea) => idea.id)).size).toBe(ideas.length);
  });

  it("stops at `count` even with more fallback keywords", () => {
    const ideas = buildIdeas(
      input({ fallbackKeywords: ["생활꿀팁", "살림 꿀팁", "자취 꿀팁"], count: 2 }),
    );

    expect(ideas.map((idea) => idea.keyword)).toEqual(["생활꿀팁", "살림 꿀팁"]);
  });

  it("builds fallback ideas without reference videos when there is no data", () => {
    const ideas = buildIdeas(input({ fallbackKeywords: ["생활꿀팁", "살림 꿀팁", "자취 꿀팁"] }));

    expect(ideas).toHaveLength(3);
    for (const idea of ideas) {
      expect(idea).toMatchObject({ fallback: true, opportunity: 0, referenceVideos: [] });
      expect(idea.id).toBe(
        `life-tips:${idea.keyword}:${expectedTemplates(CATEGORIES["life-tips"], idea.keyword).templateKey}`,
      );
    }
  });

  it("returns an equal array for the same input", () => {
    const build = () =>
      buildIdeas(input({ keywords: [MORNING], videos: VIDEOS, fallbackKeywords: ["명언"] }));

    expect(build()).toEqual(build());
  });
});
