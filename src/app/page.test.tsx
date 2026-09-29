// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Home", () => {
  it("renders the Shorts Idea Lab heading", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Shorts Idea Lab" }),
    ).toBeInTheDocument();
  });

  it("renders the description and the dashboard without fetching", () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    expect(
      screen.getByText(
        "생활 꿀팁 · 명언 · 자기객관화 쇼츠 트렌드를 분석하고 다음 콘텐츠를 추천합니다",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("카테고리를 고르고 분석하기를 누르세요.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
