// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SavedIdea } from "@/types";
import SavedIdeasPanel from "./SavedIdeasPanel";

function makeSaved(keyword: string, savedAt: string, titles?: string[]): SavedIdea {
  return {
    id: `life-tips:${keyword}:must-know`,
    scope: "life-tips",
    keyword,
    titles: titles ?? [`${keyword} 모르면 손해 보는 3가지`, `${keyword} 두 번째`, `${keyword} 세 번째`],
    hook: `${keyword}, 아직도 이렇게 하세요?`,
    reason: "근거",
    opportunity: 1.2,
    referenceVideos: [],
    fallback: false,
    savedAt,
  };
}

function setup(ideas: SavedIdea[]) {
  const onRemove = vi.fn();
  const user = userEvent.setup();
  render(<SavedIdeasPanel ideas={ideas} onRemove={onRemove} />);
  return { onRemove, user };
}

describe("SavedIdeasPanel", () => {
  it("비어 있으면 개수 0과 안내 문구를 보여 준다", () => {
    setup([]);

    expect(screen.getByRole("heading", { name: "저장한 아이디어 (0)" })).toBeInTheDocument();
    expect(
      screen.getByText("저장한 아이디어가 없습니다. 추천 카드에서 저장을 눌러 보세요."),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("항목마다 키워드, 첫 번째 제목, 저장일을 보여 준다", () => {
    const ideas = [
      makeSaved("아침루틴", "2026-09-28T23:30:00.000Z"),
      makeSaved("습관", "2026-01-05T09:00:00.000Z"),
    ];
    setup(ideas);

    expect(screen.getByRole("heading", { name: "저장한 아이디어 (2)" })).toBeInTheDocument();
    expect(
      screen.queryByText("저장한 아이디어가 없습니다. 추천 카드에서 저장을 눌러 보세요."),
    ).not.toBeInTheDocument();

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("아침루틴")).toBeInTheDocument();
    expect(within(items[0]).getByText("아침루틴 모르면 손해 보는 3가지")).toBeInTheDocument();
    expect(within(items[0]).queryByText("아침루틴 두 번째")).not.toBeInTheDocument();
    expect(within(items[0]).getByText("2026.09.28")).toBeInTheDocument();
    expect(within(items[1]).getByText("습관")).toBeInTheDocument();
    expect(within(items[1]).getByText("2026.01.05")).toBeInTheDocument();
  });

  it("저장일이 잘못된 값이면 '-'", () => {
    setup([makeSaved("아침루틴", "not-a-date")]);

    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("제목이 비어 있어도 렌더된다", () => {
    setup([makeSaved("아침루틴", "2026-09-28T00:00:00.000Z", [])]);

    expect(screen.getByText("아침루틴")).toBeInTheDocument();
  });

  it("삭제 버튼 이름에 키워드가 들어가고, 누르면 onRemove(id)", async () => {
    const ideas = [
      makeSaved("아침루틴", "2026-09-28T00:00:00.000Z"),
      makeSaved("습관", "2026-09-27T00:00:00.000Z"),
    ];
    const { onRemove, user } = setup(ideas);

    const button = screen.getByRole("button", { name: /습관/ });
    expect(button).toHaveTextContent("삭제");
    await user.click(button);

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith("life-tips:습관:must-know");
  });
});
