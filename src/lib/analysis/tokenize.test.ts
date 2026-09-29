import { describe, expect, it } from "vitest";
import videosPage from "@/services/__fixtures__/videos-page.json";
import {
  STOPWORDS,
  buildVocabulary,
  extractVideoTerms,
  normalizeText,
  stripParticle,
  toExcludedTerms,
  tokenize,
} from "./tokenize";

describe("normalizeText", () => {
  it("replaces emoji, hashtags and punctuation with spaces", () => {
    expect(normalizeText("🔥자취 꿀팁 #shorts!!")).toBe("자취 꿀팁 shorts");
    expect(normalizeText('힘들 때 "인생 명언" | 동기부여…')).toBe(
      "힘들 때 인생 명언 동기부여",
    );
  });

  it("lowercases latin letters and strips @ mentions", () => {
    expect(normalizeText("Morning ROUTINE @Channel_01")).toBe(
      "morning routine channel 01",
    );
  });

  it("composes NFD hangul into NFC", () => {
    expect(normalizeText("아침루틴".normalize("NFD"))).toBe(
      "아침루틴".normalize("NFC"),
    );
  });
});

describe("tokenize", () => {
  it("drops emoji, hashtags, punctuation and stopwords", () => {
    expect(tokenize("🔥자취 꿀팁 #shorts!!")).toEqual(["자취", "꿀팁"]);
  });

  it("gives the same tokens for NFD and NFC input", () => {
    const text = "자취생 아침루틴, 냉장고 정리";
    expect(tokenize(text.normalize("NFD"))).toEqual(
      tokenize(text.normalize("NFC")),
    );
    expect(tokenize(text.normalize("NFD"))).toEqual([
      "자취생",
      "아침루틴",
      "냉장고",
      "정리",
    ]);
  });

  it("drops pure numbers, one-character tokens and stopwords", () => {
    expect(
      tokenize("2026 3 꿀팁 집 한 줄 쇼츠 진짜 방법 SHORTS 3가지"),
    ).toEqual(["꿀팁", "3가지"]);
  });

  it("returns an empty array for empty or symbol-only text", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("🔥 #!! ...")).toEqual([]);
  });

  it.each([
    "shorts",
    "short",
    "쇼츠",
    "숏츠",
    "유튜브",
    "영상",
    "구독",
    "좋아요",
    "댓글",
    "알림",
    "오늘",
    "진짜",
    "정말",
    "그냥",
    "이것",
    "그것",
    "하는",
    "있는",
    "없는",
    "모든",
    "가지",
    "방법",
  ])("treats %s as a stopword", (word) => {
    expect(STOPWORDS.has(word)).toBe(true);
    expect(tokenize(word)).toEqual([]);
  });
});

describe("buildVocabulary", () => {
  it("collects raw tokens from every text", () => {
    expect(buildVocabulary(["아침루틴은 최고 #shorts", "#아침루틴 효과"])).toEqual(
      new Set(["아침루틴은", "최고", "아침루틴", "효과"]),
    );
  });
});

describe("stripParticle", () => {
  it("keeps a noun whose last syllable only looks like a particle", () => {
    expect(stripParticle("효과", new Set(["효과"]))).toBe("효과");
  });

  it("strips a one-syllable particle when the stem is in the vocabulary", () => {
    expect(stripParticle("아침루틴은", new Set(["아침루틴"]))).toBe("아침루틴");
  });

  it("keeps a one-syllable particle when the stem is not in the vocabulary", () => {
    expect(stripParticle("아침루틴은", new Set())).toBe("아침루틴은");
    expect(stripParticle("고양이", new Set(["고양이"]))).toBe("고양이");
  });

  it("keeps a multi-syllable particle when the stem would be one character", () => {
    expect(stripParticle("집에서", new Set(["집"]))).toBe("집에서");
  });

  it("strips a multi-syllable particle without checking the vocabulary", () => {
    expect(stripParticle("냉장고에서", new Set())).toBe("냉장고");
    expect(stripParticle("객관적으로", new Set())).toBe("객관적");
  });

  it("prefers the longest multi-syllable particle", () => {
    expect(stripParticle("인생이라는", new Set())).toBe("인생");
  });
});

describe("toExcludedTerms", () => {
  it("includes each query token and the query without spaces", () => {
    expect(toExcludedTerms(["인생 명언"])).toEqual(
      new Set(["인생", "명언", "인생명언"]),
    );
  });

  it("merges terms from several queries", () => {
    expect(toExcludedTerms(["생활 꿀팁", "#자취 꿀팁!"])).toEqual(
      new Set(["생활", "꿀팁", "생활꿀팁", "자취", "자취꿀팁"]),
    );
  });
});

describe("extractVideoTerms", () => {
  it("dedupes terms across title and tags and drops excluded terms", () => {
    const video = {
      title: "아침루틴은 습관이 전부 #아침루틴",
      tags: ["아침루틴", "습관", "인생 명언", "인생명언"],
    };
    const vocabulary = buildVocabulary([video.title, ...video.tags]);

    expect(
      extractVideoTerms(video, vocabulary, toExcludedTerms(["인생 명언"])),
    ).toEqual(["아침루틴", "습관", "전부"]);
  });

  it("drops stems that become stopwords or numbers after particle removal", () => {
    const video = { title: "방법으로 해결하는 냉장고 정리 2026까지", tags: [] };

    expect(extractVideoTerms(video, new Set(), new Set())).toEqual([
      "해결하는",
      "냉장고",
      "정리",
    ]);
  });

  it("ignores the description", () => {
    const video = {
      title: "냉장고 정리",
      tags: ["살림꿀팁"],
      description: "링크 https://example.com #구독이벤트",
    };

    expect(extractVideoTerms(video, new Set(), new Set())).toEqual([
      "냉장고",
      "정리",
      "살림꿀팁",
    ]);
  });
});

describe("videos-page fixture", () => {
  const videos = videosPage.items.map((item) => ({
    id: item.id,
    title: item.snippet.title,
    tags: item.snippet.tags,
  }));
  const vocabulary = buildVocabulary(
    videos.flatMap((video) => [video.title, ...video.tags]),
  );
  const excluded = toExcludedTerms(["인생 명언"]);

  it("builds a vocabulary without empty tokens", () => {
    expect(vocabulary.size).toBeGreaterThan(0);
    expect(vocabulary.has("")).toBe(false);
  });

  it("extracts clean, unique terms from every video", () => {
    for (const video of videos) {
      const terms = extractVideoTerms(video, vocabulary, excluded);

      expect(terms.length).toBeGreaterThan(0);
      expect(new Set(terms).size).toBe(terms.length);
      for (const term of terms) {
        expect(term).not.toBe("");
        expect(term.length).toBeGreaterThanOrEqual(2);
        expect(STOPWORDS.has(term)).toBe(false);
        expect(excluded.has(term)).toBe(false);
      }
    }
  });

  it("strips particles using stems found elsewhere in the fixture", () => {
    const video = videos.find((v) => v.id === "vidQuote002")!;

    expect(extractVideoTerms(video, vocabulary, excluded)).toEqual([
      "습관",
      "바꾼다",
      "동기부여",
    ]);
  });
});
