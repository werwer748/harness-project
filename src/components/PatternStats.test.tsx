// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DurationBucketStat, TitlePatternStat } from "@/types";
import PatternStats from "./PatternStats";

const TITLE_PATTERNS: TitlePatternStat[] = [
  { pattern: "number", label: "숫자 포함", videoCount: 2, share: 0.25, medianViewsPerDay: 1234, lift: 1.29 },
  { pattern: "question", label: "질문형", videoCount: 4, share: 0.5, medianViewsPerDay: 15300, lift: 1.8 },
  { pattern: "howto", label: "방법·꿀팁형", videoCount: 1, share: 0.125, medianViewsPerDay: 500, lift: 0.52 },
  { pattern: "short-title", label: "20자 이하 짧은 제목", videoCount: 0, share: 0, medianViewsPerDay: 0, lift: 0 },
];

const DURATION_BUCKETS: DurationBucketStat[] = [
  { bucket: "0-15", label: "15초 이하", videoCount: 1, share: 0.125, medianViewsPerDay: 500 },
  { bucket: "16-30", label: "16–30초", videoCount: 4, share: 0.5, medianViewsPerDay: 15300 },
  { bucket: "31-60", label: "31–60초", videoCount: 3, share: 0.375, medianViewsPerDay: 1234 },
  { bucket: "61-180", label: "61초–3분", videoCount: 0, share: 0, medianViewsPerDay: 0 },
];

function renderStats(
  titlePatterns: TitlePatternStat[] = TITLE_PATTERNS,
  durationBuckets: DurationBucketStat[] = DURATION_BUCKETS,
) {
  return render(<PatternStats titlePatterns={titlePatterns} durationBuckets={durationBuckets} />);
}

// 헤더 행을 뺀 데이터 행
function bodyRows(tableName: string): HTMLElement[] {
  return within(screen.getByRole("table", { name: tableName })).getAllByRole("row").slice(1);
}

function cellTexts(row: HTMLElement): (string | null)[] {
  return within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
}

function barOf(row: HTMLElement): HTMLElement {
  return within(row).getByTestId("share-bar");
}

describe("PatternStats", () => {
  it("제목 패턴과 영상 길이 두 블록을 보여 준다", () => {
    renderStats();

    expect(screen.getByRole("heading", { name: "제목 패턴" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "영상 길이" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "제목 패턴" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "영상 길이" })).toBeInTheDocument();
  });

  it("제목 패턴은 라벨·비중·일평균 조회수 중앙값·lift를 행마다 보여 준다", () => {
    renderStats();

    const rows = bodyRows("제목 패턴");
    expect(rows).toHaveLength(4);
    expect(cellTexts(rows[0])).toEqual(["숫자 포함", "25.0%", "1.2천", "×1.3"]);
    expect(cellTexts(rows[1])).toEqual(["질문형", "50.0%", "1.5만", "×1.8"]);
    expect(cellTexts(rows[3])).toEqual(["20자 이하 짧은 제목", "0.0%", "0", "×0.0"]);
  });

  it("영상 길이는 구간 라벨·비중·중앙값을 행마다 보여 준다", () => {
    renderStats();

    const rows = bodyRows("영상 길이");
    expect(rows).toHaveLength(4);
    expect(cellTexts(rows[0])).toEqual(["15초 이하", "12.5%", "500"]);
    expect(cellTexts(rows[1])).toEqual(["16–30초", "50.0%", "1.5만"]);
    expect(cellTexts(rows[3])).toEqual(["61초–3분", "0.0%", "0"]);
  });

  it("비중을 div 너비(%)의 가로 막대로 그린다", () => {
    renderStats();

    const titleRows = bodyRows("제목 패턴");
    expect(barOf(titleRows[0])).toHaveStyle({ width: "25%" });
    expect(barOf(titleRows[1])).toHaveStyle({ width: "50%" });
    expect(barOf(titleRows[3])).toHaveStyle({ width: "0%" });
    const durationRows = bodyRows("영상 길이");
    expect(barOf(durationRows[2])).toHaveStyle({ width: "37.5%" });
  });

  it("비중이 0~1 밖이거나 유한하지 않으면 막대 너비를 0~100%로 제한한다", () => {
    renderStats(TITLE_PATTERNS, [
      { ...DURATION_BUCKETS[0], share: 1.2 },
      { ...DURATION_BUCKETS[1], share: -0.1 },
      { ...DURATION_BUCKETS[2], share: Number.NaN },
    ]);

    const rows = bodyRows("영상 길이");
    expect(barOf(rows[0])).toHaveStyle({ width: "100%" });
    expect(barOf(rows[1])).toHaveStyle({ width: "0%" });
    expect(barOf(rows[2])).toHaveStyle({ width: "0%" });
  });

  it("가장 높은 lift 행의 막대만 amber, 나머지는 neutral-700", () => {
    renderStats();

    const rows = bodyRows("제목 패턴");
    expect(rows[1]).toHaveAttribute("data-highlight", "true");
    expect(barOf(rows[1])).toHaveClass("bg-amber-400");
    for (const index of [0, 2, 3]) {
      expect(rows[index]).not.toHaveAttribute("data-highlight");
      expect(barOf(rows[index])).toHaveClass("bg-neutral-700");
      expect(barOf(rows[index])).not.toHaveClass("bg-amber-400");
    }
  });

  it("최고 lift가 동점이면 먼저 나온 행 하나만 강조한다", () => {
    renderStats([
      { ...TITLE_PATTERNS[0], lift: 1.5 },
      { ...TITLE_PATTERNS[1], lift: 1.5 },
      TITLE_PATTERNS[2],
      TITLE_PATTERNS[3],
    ]);

    const rows = bodyRows("제목 패턴");
    expect(barOf(rows[0])).toHaveClass("bg-amber-400");
    expect(barOf(rows[1])).toHaveClass("bg-neutral-700");
  });

  it("모든 lift가 0이면(영상 0개) 어떤 행도 강조하지 않는다", () => {
    const empty = TITLE_PATTERNS.map((stat) => ({
      ...stat,
      videoCount: 0,
      share: 0,
      medianViewsPerDay: 0,
      lift: 0,
    }));
    renderStats(empty);

    for (const row of bodyRows("제목 패턴")) {
      expect(row).not.toHaveAttribute("data-highlight");
      expect(barOf(row)).toHaveClass("bg-neutral-700");
    }
  });

  it("영상 길이 막대는 lift가 없으므로 모두 neutral-700", () => {
    renderStats();

    for (const row of bodyRows("영상 길이")) {
      expect(barOf(row)).toHaveClass("bg-neutral-700");
      expect(barOf(row)).not.toHaveClass("bg-amber-400");
    }
  });
});
