// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { KeywordStat } from "@/types";
import KeywordTable from "./KeywordTable";

function makeKeyword(overrides: Partial<KeywordStat> = {}): KeywordStat {
  return {
    keyword: "아침루틴",
    videoCount: 2,
    channelCount: 2,
    medianViewsPerDay: 1234,
    avgEngagementRate: 0.0421,
    opportunity: 1.8,
    videoIds: ["vidA", "vidB"],
    ...overrides,
  };
}

const KEYWORDS: KeywordStat[] = [
  makeKeyword(),
  makeKeyword({
    keyword: "습관",
    videoCount: 3,
    channelCount: 2,
    medianViewsPerDay: 15300,
    avgEngagementRate: 0.05,
    opportunity: 1.18,
  }),
  makeKeyword({ keyword: "자기관리", opportunity: 0.8 }),
];

// 헤더 행을 뺀 데이터 행
function bodyRows(): HTMLElement[] {
  return screen.getAllByRole("row").slice(1);
}

function cellTexts(row: HTMLElement): (string | null)[] {
  return within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
}

describe("KeywordTable", () => {
  it("제목 뜨는 키워드로 이름 붙은 표를 보여 준다", () => {
    render(<KeywordTable keywords={KEYWORDS} />);

    expect(screen.getByRole("heading", { name: "뜨는 키워드" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "뜨는 키워드" })).toBeInTheDocument();
  });

  it("열 머리글 6개를 순서대로 보여 준다", () => {
    render(<KeywordTable keywords={KEYWORDS} />);

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "키워드",
      "영상 수",
      "채널 수",
      "일평균 조회수(중앙값)",
      "평균 참여율",
      "기회 지수",
    ]);
  });

  it("키워드마다 한 행을 입력 순서대로 그린다", () => {
    render(<KeywordTable keywords={KEYWORDS} />);

    const rows = bodyRows();
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual([
      "아침루틴",
      "습관",
      "자기관리",
    ]);
  });

  it("수치를 format 함수로 포맷한다", () => {
    render(<KeywordTable keywords={KEYWORDS} />);

    const [first, second] = bodyRows();
    expect(cellTexts(first)).toEqual(["아침루틴", "2", "2", "1.2천", "4.2%", "×1.8"]);
    expect(cellTexts(second)).toEqual(["습관", "3", "2", "1.5만", "5.0%", "×1.2"]);
  });

  it("수치 칸에는 tabular-nums를 쓴다", () => {
    render(<KeywordTable keywords={KEYWORDS} />);

    const cells = within(bodyRows()[0]).getAllByRole("cell").slice(1);
    for (const cell of cells) {
      expect(cell).toHaveClass("tabular-nums");
    }
  });

  it("기회 지수 1.5 이상은 amber로 강조한다", () => {
    render(
      <KeywordTable
        keywords={[makeKeyword({ opportunity: 1.8 }), makeKeyword({ keyword: "습관", opportunity: 1.5 })]}
      />,
    );

    expect(screen.getByText("×1.8")).toHaveClass("text-amber-400");
    expect(screen.getByText("×1.5")).toHaveClass("text-amber-400");
  });

  it("기회 지수 1 이상 1.5 미만은 강조도 흐림도 없다", () => {
    render(
      <KeywordTable
        keywords={[makeKeyword({ opportunity: 1.49 }), makeKeyword({ keyword: "습관", opportunity: 1 })]}
      />,
    );

    for (const text of ["×1.5", "×1.0"]) {
      const value = screen.getByText(text);
      expect(value).not.toHaveClass("text-amber-400");
      expect(value).not.toHaveClass("text-neutral-500");
    }
  });

  it("기회 지수 1 미만은 neutral-500으로 흐리게 보여 준다", () => {
    render(<KeywordTable keywords={[makeKeyword({ opportunity: 0.8 })]} />);

    const value = screen.getByText("×0.8");
    expect(value).toHaveClass("text-neutral-500");
    expect(value).not.toHaveClass("text-amber-400");
  });

  it("빈 배열이면 빈 상태 문구만 보여 주고 표는 없다", () => {
    render(<KeywordTable keywords={[]} />);

    expect(screen.getByRole("heading", { name: "뜨는 키워드" })).toBeInTheDocument();
    expect(
      screen.getByText("2개 이상 채널에서 반복된 키워드가 아직 없습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
