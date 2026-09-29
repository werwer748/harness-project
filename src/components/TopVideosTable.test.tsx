// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ScoredVideo } from "@/types";
import TopVideosTable from "./TopVideosTable";

function makeVideo(overrides: Partial<ScoredVideo> = {}): ScoredVideo {
  return {
    id: "vidMorning1",
    title: "5분 아침루틴 #shorts",
    description: "",
    channelId: "UC_routine",
    channelTitle: "루틴채널",
    publishedAt: "2026-09-20T09:00:00Z",
    thumbnailUrl: "https://i.ytimg.com/vi/vidMorning1/hqdefault.jpg",
    tags: [],
    durationSec: 45,
    viewCount: 15300,
    likeCount: 600,
    commentCount: 44,
    ageDays: 9,
    viewsPerDay: 1234,
    engagementRate: 0.0421,
    ...overrides,
  };
}

const VIDEOS: ScoredVideo[] = [
  makeVideo(),
  makeVideo({
    id: "vidFridge01",
    title: "냉장고 정리 꿀팁",
    channelTitle: "생활연구소",
    publishedAt: "2026-09-01T00:00:00Z",
    thumbnailUrl: "https://i.ytimg.com/vi/vidFridge01/hqdefault.jpg",
    durationSec: 125,
    viewCount: 999,
    viewsPerDay: 35.7,
    engagementRate: 0.1,
  }),
];

// 헤더 행을 뺀 데이터 행
function bodyRows(): HTMLElement[] {
  return screen.getAllByRole("row").slice(1);
}

describe("TopVideosTable", () => {
  it("제목에 영상 수를 넣어 TOP n으로 보여 준다", () => {
    render(<TopVideosTable videos={VIDEOS} />);

    expect(screen.getByRole("heading", { name: "잘 되는 쇼츠 TOP 2" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "잘 되는 쇼츠 TOP 2" })).toBeInTheDocument();
  });

  it("열 머리글 7개를 순서대로 보여 준다", () => {
    render(<TopVideosTable videos={VIDEOS} />);

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "썸네일",
      "제목",
      "조회수",
      "일평균 조회수",
      "참여율",
      "길이",
      "게시일",
    ]);
  });

  it("영상마다 한 행을 입력 순서대로 그린다", () => {
    render(<TopVideosTable videos={VIDEOS} />);

    const rows = bodyRows();
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole("link")).toHaveTextContent("5분 아침루틴 #shorts");
    expect(within(rows[1]).getByRole("link")).toHaveTextContent("냉장고 정리 꿀팁");
  });

  it("수치를 format 함수로 포맷한다", () => {
    render(<TopVideosTable videos={VIDEOS} />);

    const [first, second] = bodyRows();
    expect(
      within(first)
        .getAllByRole("cell")
        .slice(2)
        .map((cell) => cell.textContent),
    ).toEqual(["1.5만", "1.2천", "4.2%", "45초", "2026.09.20"]);
    expect(
      within(second)
        .getAllByRole("cell")
        .slice(2)
        .map((cell) => cell.textContent),
    ).toEqual(["999", "36", "10.0%", "2분 5초", "2026.09.01"]);
  });

  it("게시일은 publishedAt을 dateTime으로 갖는 time 요소다", () => {
    render(<TopVideosTable videos={VIDEOS} />);

    const time = screen.getByText("2026.09.20");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("dateTime", "2026-09-20T09:00:00Z");
  });

  it("제목은 새 탭으로 여는 쇼츠 링크이고 채널명을 함께 보여 준다", () => {
    render(<TopVideosTable videos={VIDEOS} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(screen.getByRole("link", { name: "5분 아침루틴 #shorts" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/shorts/vidMorning1",
    );
    expect(screen.getByRole("link", { name: "냉장고 정리 꿀팁" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/shorts/vidFridge01",
    );
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(within(bodyRows()[0]).getByText("루틴채널")).toBeInTheDocument();
    expect(within(bodyRows()[1]).getByText("생활연구소")).toBeInTheDocument();
  });

  it("썸네일은 제목을 alt로 갖는 이미지이고 i.ytimg.com은 최적화 경로로 불러온다", () => {
    render(<TopVideosTable videos={VIDEOS} />);

    const image = screen.getByRole("img", { name: "5분 아침루틴 #shorts" });
    expect(image.getAttribute("src")).toContain(
      encodeURIComponent("https://i.ytimg.com/vi/vidMorning1/hqdefault.jpg"),
    );
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.queryByTestId("thumbnail-placeholder")).not.toBeInTheDocument();
  });

  it("thumbnailUrl이 비어 있으면 이미지 대신 회색 박스를 둔다", () => {
    render(<TopVideosTable videos={[makeVideo({ thumbnailUrl: "" }), VIDEOS[1]]} />);

    const [first, second] = bodyRows();
    expect(within(first).queryByRole("img")).not.toBeInTheDocument();
    const placeholder = within(first).getByTestId("thumbnail-placeholder");
    expect(placeholder).toHaveClass("bg-neutral-800");
    expect(within(second).getByRole("img", { name: "냉장고 정리 꿀팁" })).toBeInTheDocument();
    expect(within(second).queryByTestId("thumbnail-placeholder")).not.toBeInTheDocument();
  });

  it("URL로 읽을 수 없거나 https가 아닌 썸네일도 회색 박스로 둔다", () => {
    render(
      <TopVideosTable
        videos={[
          makeVideo({ id: "a", thumbnailUrl: "not a url" }),
          makeVideo({ id: "b", thumbnailUrl: "http://i.ytimg.com/vi/b/hqdefault.jpg" }),
        ]}
      />,
    );

    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(screen.getAllByTestId("thumbnail-placeholder")).toHaveLength(2);
  });

  it("i.ytimg.com 외 https 호스트는 최적화 없이(unoptimized) 원본 URL로 불러온다", () => {
    const url = "https://i9.ytimg.com/vi/vidMorning1/hqdefault.jpg";
    render(<TopVideosTable videos={[makeVideo({ thumbnailUrl: url })]} />);

    expect(screen.getByRole("img", { name: "5분 아침루틴 #shorts" })).toHaveAttribute("src", url);
  });

  it("수치 칸에는 tabular-nums를 쓴다", () => {
    render(<TopVideosTable videos={VIDEOS} />);

    for (const cell of within(bodyRows()[0]).getAllByRole("cell").slice(2)) {
      expect(cell).toHaveClass("tabular-nums");
    }
  });

  it("빈 배열이면 빈 상태 문구만 보여 주고 표는 없다", () => {
    render(<TopVideosTable videos={[]} />);

    expect(screen.getByText("조건에 맞는 쇼츠가 없습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
