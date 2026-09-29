import { describe, expect, it } from "vitest";
import type { TemplateSet } from "@/types";
import {
  CATEGORIES,
  CATEGORY_IDS,
  CUSTOM_TEMPLATES,
  DAYS_OPTIONS,
  getTemplateSet,
  isCategoryId,
  isDays,
} from "./categories";

const templateSets: [string, TemplateSet][] = [
  ...CATEGORY_IDS.map((id): [string, TemplateSet] => [id, CATEGORIES[id]]),
  ["custom", CUSTOM_TEMPLATES],
];

describe("CATEGORIES", () => {
  it("lists category ids in a fixed order", () => {
    expect(CATEGORY_IDS).toEqual(["life-tips", "quotes", "self-reflection"]);
    expect(Object.keys(CATEGORIES).sort()).toEqual([...CATEGORY_IDS].sort());
  });

  it("has matching id, label and description for every category", () => {
    expect(CATEGORIES["life-tips"].label).toBe("생활 꿀팁");
    expect(CATEGORIES.quotes.label).toBe("명언");
    expect(CATEGORIES["self-reflection"].label).toBe("자기객관화");

    for (const id of CATEGORY_IDS) {
      expect(CATEGORIES[id].id).toBe(id);
      expect(CATEGORIES[id].description.trim()).not.toBe("");
    }
  });

  it.each(CATEGORY_IDS)("%s has exactly 3 non-empty seed keywords", (id) => {
    const seeds = CATEGORIES[id].seedKeywords;

    expect(seeds).toHaveLength(3);
    for (const seed of seeds) {
      expect(seed.trim()).not.toBe("");
    }
  });

  it("uses the specified seed keywords", () => {
    expect(CATEGORIES["life-tips"].seedKeywords).toEqual([
      "생활꿀팁",
      "살림 꿀팁",
      "자취 꿀팁",
    ]);
    expect(CATEGORIES.quotes.seedKeywords).toEqual([
      "명언",
      "인생 명언",
      "동기부여 명언",
    ]);
    expect(CATEGORIES["self-reflection"].seedKeywords).toEqual([
      "자기객관화",
      "자기성찰",
      "메타인지",
    ]);
  });
});

describe.each(templateSets)("template set %s", (_name, set) => {
  it("has at least 6 titles and 4 hooks", () => {
    expect(set.titleTemplates.length).toBeGreaterThanOrEqual(6);
    expect(set.hookTemplates.length).toBeGreaterThanOrEqual(4);
  });

  it("includes {keyword} in every title and hook", () => {
    for (const { text } of set.titleTemplates) {
      expect(text).toContain("{keyword}");
    }
    for (const hook of set.hookTemplates) {
      expect(hook).toContain("{keyword}");
    }
  });

  it("has unique, non-empty title keys", () => {
    const keys = set.titleTemplates.map((t) => t.key);

    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key.trim()).not.toBe("");
    }
  });
});

describe("DAYS_OPTIONS", () => {
  it("is [7, 30, 90]", () => {
    expect(DAYS_OPTIONS).toEqual([7, 30, 90]);
  });
});

describe("isCategoryId", () => {
  it.each(["life-tips", "quotes", "self-reflection"])("accepts %s", (value) => {
    expect(isCategoryId(value)).toBe(true);
  });

  it.each([["custom"], ["x"], [15], ["30"], [""], [null], [undefined]])(
    "rejects %s",
    (value) => {
      expect(isCategoryId(value)).toBe(false);
    },
  );
});

describe("isDays", () => {
  it.each([7, 30, 90])("accepts %s", (value) => {
    expect(isDays(value)).toBe(true);
  });

  it.each([["custom"], ["x"], [15], ["30"], [0], [NaN], [null], [undefined]])(
    "rejects %s",
    (value) => {
      expect(isDays(value)).toBe(false);
    },
  );
});

describe("getTemplateSet", () => {
  it("returns CUSTOM_TEMPLATES for custom scope", () => {
    expect(getTemplateSet("custom")).toBe(CUSTOM_TEMPLATES);
  });

  it.each(CATEGORY_IDS)("returns the category's templates for %s", (id) => {
    const set = getTemplateSet(id);

    expect(set.titleTemplates).toBe(CATEGORIES[id].titleTemplates);
    expect(set.hookTemplates).toBe(CATEGORIES[id].hookTemplates);
  });
});
