// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ContentIdea } from "@/types";
import IdeaCard from "./IdeaCard";

function makeIdea(overrides: Partial<ContentIdea> = {}): ContentIdea {
  return {
    id: "life-tips:아침루틴:must-know",
    scope: "life-tips",
    keyword: "아침루틴",
    titles: [
      "아침루틴 모르면 손해 보는 3가지",
      "아침루틴, 다들 이렇게 잘못하고 있어요",
      "1분 만에 끝내는 아침루틴 꿀팁",
    ],
    hook: "아침루틴, 아직도 이렇게 하세요?",
    reason:
      "'아침루틴' 쇼츠 2개(채널 2곳)의 일평균 조회수가 전체 중앙값의 1.8배, 평균 참여율 4.2%",
    opportunity: 1.8,
    referenceVideos: [
      { id: "vidA", title: "5분 아침루틴", channelTitle: "루틴채널", viewCount: 15300, viewsPerDay: 1234 },
      { id: "vidB", title: "직장인 아침루틴", channelTitle: "생활연구소", viewCount: 999, viewsPerDay: 100 },
    ],
    fallback: false,
    ...overrides,
  };
}

function setup(idea = makeIdea(), saved = false) {
  const onToggleSave = vi.fn();
  const user = userEvent.setup();
  render(<IdeaCard idea={idea} saved={saved} onToggleSave={onToggleSave} />);
  return { onToggleSave, user };
}

describe("IdeaCard", () => {
  it("키워드, 제목 후보 3개(번호 목록), 훅, 근거를 보여 준다", () => {
    const idea = makeIdea();
    setup(idea);

    expect(screen.getByRole("heading", { name: "아침루틴" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "제목 후보" });
    expect(list.tagName).toBe("OL");
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(idea.titles);
    expect(screen.getByText("첫 3초:")).toBeInTheDocument();
    expect(screen.getByText(idea.hook)).toBeInTheDocument();
    expect(screen.getByText(idea.reason)).toBeInTheDocument();
  });

  it("카드는 키워드를 이름으로 갖는 article이다", () => {
    setup();

    expect(screen.getByRole("article", { name: "아침루틴" })).toBeInTheDocument();
  });

  it("참고 영상을 새 탭 쇼츠 링크로 보여 준다", () => {
    setup();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(screen.getByRole("link", { name: "5분 아침루틴" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/shorts/vidA",
    );
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(screen.getByText(/루틴채널/)).toBeInTheDocument();
  });

  it("참고 영상이 없으면 링크가 없다", () => {
    setup(makeIdea({ referenceVideos: [] }));

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("기회 지수를 ×로 보여 주고 1.5 이상이면 amber로 강조한다", () => {
    setup(makeIdea({ opportunity: 1.8 }));

    const value = screen.getByText("×1.8");
    expect(value).toHaveClass("text-amber-400");
  });

  it("기회 지수가 1.5 미만이면 amber가 아니다", () => {
    setup(makeIdea({ opportunity: 1.29 }));

    const value = screen.getByText("×1.3");
    expect(value).not.toHaveClass("text-amber-400");
  });

  it("기회 지수가 정확히 1.5면 amber", () => {
    setup(makeIdea({ opportunity: 1.5 }));

    expect(screen.getByText("×1.5")).toHaveClass("text-amber-400");
  });

  it("fallback이면 기본 제안을 표시하고 0배 기회 지수는 보여 주지 않는다", () => {
    setup(makeIdea({ fallback: true, opportunity: 0 }));

    expect(screen.getByText("기본 제안")).toBeInTheDocument();
    expect(screen.queryByText("×0.0")).not.toBeInTheDocument();
  });

  it("fallback이 아니면 기본 제안이 없다", () => {
    setup();

    expect(screen.queryByText("기본 제안")).not.toBeInTheDocument();
  });

  it("저장 전이면 aria-pressed=false, 텍스트 저장", () => {
    setup(makeIdea(), false);

    const button = screen.getByRole("button", { name: "저장" });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("저장됐으면 aria-pressed=true, 텍스트 저장됨", () => {
    setup(makeIdea(), true);

    const button = screen.getByRole("button", { name: "저장됨" });
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("저장 버튼을 누르면 onToggleSave(idea)", async () => {
    const idea = makeIdea();
    const { onToggleSave, user } = setup(idea);

    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(onToggleSave).toHaveBeenCalledTimes(1);
    expect(onToggleSave).toHaveBeenCalledWith(idea);
  });
});
