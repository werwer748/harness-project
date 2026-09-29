import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContentIdea, SavedIdea } from "@/types";
import {
  MAX_SAVED_IDEAS,
  SAVED_IDEAS_KEY,
  getBrowserStorage,
  isIdeaSaved,
  loadSavedIdeas,
  removeIdea,
  saveIdea,
} from "./savedIdeas";

const NOW = new Date("2026-09-29T00:00:00.000Z");
const LATER = new Date("2026-09-30T12:34:56.000Z");

function createMemoryStorage(initial?: string) {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(SAVED_IDEAS_KEY, initial);
  return {
    map,
    getItem: vi.fn((key: string) => map.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      map.set(key, value);
    }),
  };
}

function createFullStorage(initial?: string) {
  const storage = createMemoryStorage(initial);
  storage.setItem.mockImplementation(() => {
    throw new DOMException("quota", "QuotaExceededError");
  });
  return storage;
}

function makeIdea(keyword: string, overrides: Partial<ContentIdea> = {}): ContentIdea {
  return {
    id: `life-tips:${keyword}:list`,
    scope: "life-tips",
    keyword,
    titles: [`${keyword} 제목 1`, `${keyword} 제목 2`, `${keyword} 제목 3`],
    hook: `${keyword} 훅`,
    reason: `'${keyword}' 쇼츠 2개(채널 2곳)의 일평균 조회수가 전체 중앙값의 1.3배, 평균 참여율 4.2%`,
    opportunity: 1.29,
    referenceVideos: [
      {
        id: "vid01",
        title: `${keyword} 참고 영상`,
        channelTitle: "채널A",
        viewCount: 12000,
        viewsPerDay: 400,
      },
    ],
    fallback: false,
    ...overrides,
  };
}

function omit(idea: SavedIdea, key: keyof SavedIdea): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...idea };
  delete copy[key];
  return copy;
}

function stored(storage: ReturnType<typeof createMemoryStorage>): unknown {
  const raw = storage.map.get(SAVED_IDEAS_KEY);
  return raw === undefined ? undefined : JSON.parse(raw);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("constants", () => {
  it("uses a versioned storage key and a 100-item cap", () => {
    expect(SAVED_IDEAS_KEY).toBe("shorts-idea-lab:saved-ideas:v1");
    expect(MAX_SAVED_IDEAS).toBe(100);
  });
});

describe("loadSavedIdeas", () => {
  it("returns [] for an empty storage", () => {
    const storage = createMemoryStorage();
    expect(loadSavedIdeas(storage)).toEqual([]);
    expect(storage.getItem).toHaveBeenCalledWith(SAVED_IDEAS_KEY);
  });

  it.each([
    ["broken JSON", "{not json"],
    ["an object", JSON.stringify({ id: "a", keyword: "k", titles: [], savedAt: "x" })],
    ["null", "null"],
    ["a string", JSON.stringify("hello")],
    ["a number", "42"],
    ["an empty string", ""],
  ])("returns [] without throwing for %s", (_label, raw) => {
    expect(() => loadSavedIdeas(createMemoryStorage(raw))).not.toThrow();
    expect(loadSavedIdeas(createMemoryStorage(raw))).toEqual([]);
  });

  it("keeps only valid items when invalid ones are mixed in", () => {
    const first: SavedIdea = { ...makeIdea("아침루틴"), savedAt: LATER.toISOString() };
    const second: SavedIdea = { ...makeIdea("습관"), savedAt: NOW.toISOString() };
    const raw = JSON.stringify([
      null,
      first,
      42,
      "idea",
      [],
      omit(first, "id"),
      omit(first, "keyword"),
      omit(first, "titles"),
      omit(first, "savedAt"),
      { ...first, id: 123 },
      { ...first, titles: "제목" },
      { ...first, titles: ["제목", 1] },
      { ...first, savedAt: null },
      second,
    ]);

    expect(() => loadSavedIdeas(createMemoryStorage(raw))).not.toThrow();
    expect(loadSavedIdeas(createMemoryStorage(raw))).toEqual([first, second]);
  });

  it("keeps only the first item when an id appears twice", () => {
    const newer: SavedIdea = { ...makeIdea("습관"), savedAt: LATER.toISOString() };
    const older: SavedIdea = { ...newer, savedAt: NOW.toISOString() };
    const storage = createMemoryStorage(JSON.stringify([newer, older]));
    expect(loadSavedIdeas(storage)).toEqual([newer]);
  });

  it("returns [] without throwing when getItem throws", () => {
    const storage = createMemoryStorage();
    storage.getItem.mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(loadSavedIdeas(storage)).toEqual([]);
  });

  it("returns [] for storage = null", () => {
    expect(loadSavedIdeas(null)).toEqual([]);
  });

  it("returns [] when storage is omitted outside the browser", () => {
    expect(loadSavedIdeas()).toEqual([]);
  });
});

describe("saveIdea", () => {
  it("round-trips a saved idea with savedAt from now", () => {
    const storage = createMemoryStorage();
    const idea = makeIdea("아침루틴");

    const result = saveIdea(idea, NOW, storage);

    const expected: SavedIdea = { ...idea, savedAt: "2026-09-29T00:00:00.000Z" };
    expect(result).toEqual([expected]);
    expect(loadSavedIdeas(storage)).toEqual([expected]);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem.mock.calls[0][0]).toBe(SAVED_IDEAS_KEY);
  });

  it("puts the newest idea first", () => {
    const storage = createMemoryStorage();
    saveIdea(makeIdea("아침루틴"), NOW, storage);
    const result = saveIdea(makeIdea("습관"), LATER, storage);

    expect(result.map((idea) => idea.keyword)).toEqual(["습관", "아침루틴"]);
    expect(loadSavedIdeas(storage)).toEqual(result);
  });

  it("stores the whole idea snapshot", () => {
    const storage = createMemoryStorage();
    const idea = makeIdea("자기관리", { scope: "custom", fallback: true, opportunity: 0 });

    saveIdea(idea, NOW, storage);
    // 원본을 바꿔도 저장된 스냅샷은 그대로여야 한다
    idea.titles[0] = "바뀐 제목";
    idea.referenceVideos[0].title = "바뀐 참고 영상";

    expect(stored(storage)).toEqual([
      { ...makeIdea("자기관리", { scope: "custom", fallback: true, opportunity: 0 }), savedAt: NOW.toISOString() },
    ]);
  });

  it("does not change the list when the same id is saved twice", () => {
    const storage = createMemoryStorage();
    const idea = makeIdea("아침루틴");
    const first = saveIdea(idea, NOW, storage);

    const second = saveIdea({ ...idea, hook: "다른 훅" }, LATER, storage);

    expect(second).toEqual(first);
    expect(second).toHaveLength(1);
    expect(second[0].savedAt).toBe(NOW.toISOString());
    expect(loadSavedIdeas(storage)).toEqual(first);
  });

  it("keeps the given id as-is", () => {
    const storage = createMemoryStorage();
    const idea = makeIdea("습관", { id: "self-reflection:습관:question" });
    expect(saveIdea(idea, NOW, storage)[0].id).toBe("self-reflection:습관:question");
  });

  it(`drops the oldest ideas beyond ${MAX_SAVED_IDEAS}`, () => {
    const storage = createMemoryStorage();
    let result: SavedIdea[] = [];
    for (let i = 0; i <= MAX_SAVED_IDEAS; i += 1) {
      result = saveIdea(makeIdea(`키워드${i}`), new Date(NOW.getTime() + i * 1000), storage);
    }

    expect(result).toHaveLength(MAX_SAVED_IDEAS);
    expect(result[0].keyword).toBe(`키워드${MAX_SAVED_IDEAS}`);
    expect(result[MAX_SAVED_IDEAS - 1].keyword).toBe("키워드1");
    expect(isIdeaSaved(result, makeIdea("키워드0").id)).toBe(false);
    expect(loadSavedIdeas(storage)).toEqual(result);
  });

  it("replaces a corrupted value with the new list", () => {
    const storage = createMemoryStorage("{not json");
    const result = saveIdea(makeIdea("습관"), NOW, storage);
    expect(result).toHaveLength(1);
    expect(loadSavedIdeas(storage)).toEqual(result);
  });

  it("returns the computed list without throwing when setItem throws", () => {
    const existing: SavedIdea = { ...makeIdea("아침루틴"), savedAt: NOW.toISOString() };
    const storage = createFullStorage(JSON.stringify([existing]));

    let result: SavedIdea[] = [];
    expect(() => {
      result = saveIdea(makeIdea("습관"), LATER, storage);
    }).not.toThrow();

    expect(result).toEqual([{ ...makeIdea("습관"), savedAt: LATER.toISOString() }, existing]);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it("returns the computed list without throwing for storage = null", () => {
    const idea = makeIdea("습관");
    expect(saveIdea(idea, NOW, null)).toEqual([{ ...idea, savedAt: NOW.toISOString() }]);
  });

  it("does not throw when storage is omitted outside the browser", () => {
    const idea = makeIdea("습관");
    expect(saveIdea(idea, NOW)).toEqual([{ ...idea, savedAt: NOW.toISOString() }]);
  });
});

describe("removeIdea", () => {
  it("removes the idea with the given id", () => {
    const storage = createMemoryStorage();
    saveIdea(makeIdea("아침루틴"), NOW, storage);
    saveIdea(makeIdea("습관"), LATER, storage);

    const result = removeIdea(makeIdea("습관").id, storage);

    expect(result).toEqual([{ ...makeIdea("아침루틴"), savedAt: NOW.toISOString() }]);
    expect(loadSavedIdeas(storage)).toEqual(result);
  });

  it("keeps the list when the id does not exist", () => {
    const storage = createMemoryStorage();
    const saved = saveIdea(makeIdea("아침루틴"), NOW, storage);
    expect(removeIdea("custom:없음:list", storage)).toEqual(saved);
    expect(loadSavedIdeas(storage)).toEqual(saved);
  });

  it("returns the computed list without throwing when setItem throws", () => {
    const first: SavedIdea = { ...makeIdea("아침루틴"), savedAt: NOW.toISOString() };
    const second: SavedIdea = { ...makeIdea("습관"), savedAt: NOW.toISOString() };
    const storage = createFullStorage(JSON.stringify([first, second]));

    expect(removeIdea(first.id, storage)).toEqual([second]);
  });

  it("returns [] without throwing for storage = null", () => {
    expect(removeIdea("life-tips:습관:list", null)).toEqual([]);
  });
});

describe("isIdeaSaved", () => {
  it("checks by id", () => {
    const ideas: SavedIdea[] = [{ ...makeIdea("습관"), savedAt: NOW.toISOString() }];
    expect(isIdeaSaved(ideas, makeIdea("습관").id)).toBe(true);
    expect(isIdeaSaved(ideas, makeIdea("아침루틴").id)).toBe(false);
    expect(isIdeaSaved([], makeIdea("습관").id)).toBe(false);
  });
});

describe("getBrowserStorage", () => {
  it("returns null in node (no window)", () => {
    expect(typeof window).toBe("undefined");
    expect(getBrowserStorage()).toBeNull();
  });

  it("returns window.localStorage when it is available", () => {
    const storage = createMemoryStorage();
    vi.stubGlobal("window", { localStorage: storage });

    expect(getBrowserStorage()).toBe(storage);
    saveIdea(makeIdea("습관"), NOW);
    expect(loadSavedIdeas()).toEqual([{ ...makeIdea("습관"), savedAt: NOW.toISOString() }]);
  });

  it("returns null when accessing window.localStorage throws", () => {
    const blocked = {};
    Object.defineProperty(blocked, "localStorage", {
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });
    vi.stubGlobal("window", blocked);

    expect(getBrowserStorage()).toBeNull();
    expect(loadSavedIdeas()).toEqual([]);
    expect(() => saveIdea(makeIdea("습관"), NOW)).not.toThrow();
  });
});
