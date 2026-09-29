// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReportSummary } from "@/types";
import SummaryStats from "./SummaryStats";

const SUMMARY: ReportSummary = {
  videoCount: 7,
  channelCount: 4,
  medianViews: 15300,
  medianViewsPerDay: 1234,
  avgEngagementRate: 0.0421,
  avgDurationSec: 125,
};

// 라벨(dt) 바로 다음의 수치(dd)를 읽는다
function valueOf(label: string): string | null {
  const term = screen.getByText(label);
  return term.nextElementSibling?.textContent ?? null;
}

describe("SummaryStats", () => {
  it("제목에 검색어와 기간을 보여 준다", () => {
    render(<SummaryStats summary={SUMMARY} query="생활 꿀팁" days={30} />);

    expect(screen.getByRole("heading", { name: "생활 꿀팁 · 최근 30일" })).toBeInTheDocument();
  });

  it("수치 6칸을 라벨과 함께 보여 준다", () => {
    render(<SummaryStats summary={SUMMARY} query="생활 꿀팁" days={30} />);

    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "분석한 쇼츠",
      "채널 수",
      "조회수 중앙값",
      "일평균 조회수 중앙값",
      "평균 참여율",
      "평균 길이",
    ]);
    expect(valueOf("분석한 쇼츠")).toBe("7");
    expect(valueOf("채널 수")).toBe("4");
    expect(valueOf("조회수 중앙값")).toBe("1.5만");
    expect(valueOf("일평균 조회수 중앙값")).toBe("1.2천");
  });

  it("참여율은 퍼센트, 길이는 분·초로 포맷한다", () => {
    render(<SummaryStats summary={SUMMARY} query="생활 꿀팁" days={30} />);

    expect(valueOf("평균 참여율")).toBe("4.2%");
    expect(valueOf("평균 길이")).toBe("2분 5초");
  });

  it("수치에는 tabular-nums를 쓴다", () => {
    render(<SummaryStats summary={SUMMARY} query="생활 꿀팁" days={30} />);

    for (const value of screen.getAllByRole("definition")) {
      expect(value).toHaveClass("tabular-nums");
    }
  });

  it("영상이 0개인 요약도 그대로 보여 준다", () => {
    const empty: ReportSummary = {
      videoCount: 0,
      channelCount: 0,
      medianViews: 0,
      medianViewsPerDay: 0,
      avgEngagementRate: 0,
      avgDurationSec: 0,
    };
    render(<SummaryStats summary={empty} query="아침 루틴" days={7} />);

    expect(screen.getByRole("heading", { name: "아침 루틴 · 최근 7일" })).toBeInTheDocument();
    expect(valueOf("분석한 쇼츠")).toBe("0");
    expect(valueOf("평균 참여율")).toBe("0.0%");
    expect(valueOf("평균 길이")).toBe("0초");
  });
});
