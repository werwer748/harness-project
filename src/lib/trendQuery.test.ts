import { describe, expect, it } from "vitest";
import { CATEGORY_IDS, DAYS_OPTIONS } from "@/lib/categories";
import type { TrendQuery } from "@/types";
import {
  MAX_QUERY_LENGTH,
  parseTrendQuery,
  toTrendSearchParams,
} from "./trendQuery";

function parse(params: Record<string, string>) {
  return parseTrendQuery(new URLSearchParams(params));
}

function expectError(params: Record<string, string>): string {
  const result = parse(params);
  if (result.ok) throw new Error(`에러를 기대했지만 성공: ${JSON.stringify(result)}`);
  expect(result.message).toMatch(/[가-힣]/);
  return result.message;
}

describe("parseTrendQuery", () => {
  it("parses a category query", () => {
    expect(parse({ category: "quotes", days: "7" })).toEqual({
      ok: true,
      query: { kind: "category", category: "quotes", days: 7 },
    });
  });

  it("parses a custom query with trimmed q and ignores category", () => {
    expect(
      parse({ q: "  아침 루틴 ", category: "not-a-category", days: "90" }),
    ).toEqual({ ok: true, query: { kind: "custom", q: "아침 루틴", days: 90 } });
  });

  it("defaults days to 30 when it is missing", () => {
    expect(parse({ category: "self-reflection" })).toEqual({
      ok: true,
      query: { kind: "category", category: "self-reflection", days: 30 },
    });
    expect(parse({ q: "습관" })).toEqual({
      ok: true,
      query: { kind: "custom", q: "습관", days: 30 },
    });
  });

  it.each(DAYS_OPTIONS)("accepts days=%i", (days) => {
    expect(parse({ category: "life-tips", days: String(days) })).toEqual({
      ok: true,
      query: { kind: "category", category: "life-tips", days },
    });
  });

  it("fails when neither category nor q is given", () => {
    expect(expectError({})).toContain("category");
    expect(expectError({ days: "7" })).toContain("category");
  });

  it("fails on an unknown category with the allowed list", () => {
    expect(expectError({ category: "music" })).toBe(
      "category는 life-tips, quotes, self-reflection 중 하나여야 합니다",
    );
  });

  it.each(["15", "abc", "", "0", "-7", "7.5", "07"])(
    "fails on days=%j",
    (days) => {
      expect(expectError({ category: "quotes", days })).toContain("days");
    },
  );

  it("validates days for custom queries too", () => {
    expect(expectError({ q: "습관", days: "15" })).toContain("days");
  });

  it(`accepts q up to ${MAX_QUERY_LENGTH} characters and rejects longer`, () => {
    expect(MAX_QUERY_LENGTH).toBe(50);
    const max = "가".repeat(MAX_QUERY_LENGTH);

    expect(parse({ q: max })).toEqual({
      ok: true,
      query: { kind: "custom", q: max, days: 30 },
    });
    // 앞뒤 공백은 trim한 뒤 길이를 잰다
    expect(parse({ q: `  ${max}  ` })).toEqual({
      ok: true,
      query: { kind: "custom", q: max, days: 30 },
    });
    expect(expectError({ q: `${max}나` })).toContain("50");
  });

  it("treats a whitespace-only q as absent and falls back to category", () => {
    expect(parse({ q: "   ", category: "life-tips", days: "7" })).toEqual({
      ok: true,
      query: { kind: "category", category: "life-tips", days: 7 },
    });
    expect(expectError({ q: "   " })).toContain("category");
  });
});

describe("toTrendSearchParams", () => {
  it("serializes a category query without q", () => {
    const params = toTrendSearchParams({
      kind: "category",
      category: "quotes",
      days: 7,
    });
    expect(params.toString()).toBe("category=quotes&days=7");
  });

  it("serializes a custom query without category", () => {
    const params = toTrendSearchParams({ kind: "custom", q: "아침 루틴", days: 90 });
    expect(params.get("q")).toBe("아침 루틴");
    expect(params.get("days")).toBe("90");
    expect(params.has("category")).toBe(false);
  });

  const roundTripCases: TrendQuery[] = [
    ...CATEGORY_IDS.flatMap((category) =>
      DAYS_OPTIONS.map((days): TrendQuery => ({ kind: "category", category, days })),
    ),
    ...DAYS_OPTIONS.map((days): TrendQuery => ({ kind: "custom", q: "습관", days })),
    { kind: "custom", q: "아침 루틴 & 습관? #꿀팁 =100%", days: 30 },
    { kind: "custom", q: "가".repeat(MAX_QUERY_LENGTH), days: 7 },
  ];

  it.each(roundTripCases)("round-trips %j", (query) => {
    const serialized = toTrendSearchParams(query).toString();
    expect(parseTrendQuery(new URLSearchParams(serialized))).toEqual({
      ok: true,
      query,
    });
  });
});
