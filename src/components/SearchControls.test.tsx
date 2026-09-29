// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CATEGORIES, CATEGORY_IDS } from "@/lib/categories";
import { MAX_QUERY_LENGTH } from "@/lib/trendQuery";
import SearchControls from "./SearchControls";

function setup(props: Partial<Parameters<typeof SearchControls>[0]> = {}) {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<SearchControls loading={false} onSubmit={onSubmit} {...props} />);
  return { onSubmit, user };
}

const input = () => screen.getByPlaceholderText("직접 키워드 입력 (선택)");
const submitButton = () => screen.getByRole("button", { name: /분석/ });
const categoryButton = (label: string) => screen.getByRole("button", { name: label });

describe("SearchControls", () => {
  it("카테고리 버튼 3개를 CATEGORY_IDS 순서로 보여 주고 기본값은 생활 꿀팁이다", () => {
    setup();

    const labels = CATEGORY_IDS.map((id) => CATEGORIES[id].label);
    const buttons = screen
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("aria-pressed"));
    expect(buttons.map((button) => button.textContent)).toEqual(labels);
    expect(categoryButton("생활 꿀팁")).toHaveAttribute("aria-pressed", "true");
    expect(categoryButton("명언")).toHaveAttribute("aria-pressed", "false");
    expect(categoryButton("자기객관화")).toHaveAttribute("aria-pressed", "false");
  });

  it("기간 select는 DAYS_OPTIONS를 라벨과 함께 보여 주고 기본값은 30일이다", () => {
    setup();

    const select = screen.getByRole("combobox", { name: "기간" });
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["최근 7일", "최근 30일", "최근 90일"]);
    expect(select).toHaveValue("30");
  });

  it("입력 필드는 MAX_QUERY_LENGTH로 길이를 제한한다", () => {
    setup();

    expect(input()).toHaveAttribute("maxLength", String(MAX_QUERY_LENGTH));
  });

  it("기본 상태로 제출하면 생활 꿀팁 30일 category 쿼리", async () => {
    const { onSubmit, user } = setup();

    await user.click(submitButton());

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      kind: "category",
      category: "life-tips",
      days: 30,
    });
  });

  it("카테고리를 클릭하고 기간을 바꾼 뒤 제출하면 그 category 쿼리", async () => {
    const { onSubmit, user } = setup();

    await user.click(categoryButton("명언"));
    await user.selectOptions(screen.getByRole("combobox", { name: "기간" }), "최근 7일");
    await user.click(submitButton());

    expect(categoryButton("명언")).toHaveAttribute("aria-pressed", "true");
    expect(categoryButton("생활 꿀팁")).toHaveAttribute("aria-pressed", "false");
    expect(onSubmit).toHaveBeenCalledWith({ kind: "category", category: "quotes", days: 7 });
  });

  it("키워드를 입력하고 Enter를 누르면 trim한 custom 쿼리", async () => {
    const { onSubmit, user } = setup();

    await user.type(input(), "  아침 루틴  {Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ kind: "custom", q: "아침 루틴", days: 30 });
  });

  it("키워드가 있으면 카테고리 버튼은 눌리지 않은 상태로 보인다", async () => {
    const { user } = setup();

    await user.type(input(), "아침 루틴");

    for (const id of CATEGORY_IDS) {
      expect(categoryButton(CATEGORIES[id].label)).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("공백만 입력하면 category 쿼리", async () => {
    const { onSubmit, user } = setup();

    await user.click(categoryButton("자기객관화"));
    await user.type(input(), "   {Enter}");

    expect(onSubmit).toHaveBeenCalledWith({
      kind: "category",
      category: "self-reflection",
      days: 30,
    });
  });

  it("키워드 입력 후 카테고리를 클릭하면 입력을 비우고 category 쿼리", async () => {
    const { onSubmit, user } = setup();

    await user.type(input(), "아침 루틴");
    await user.click(categoryButton("명언"));
    await user.click(submitButton());

    expect(input()).toHaveValue("");
    expect(onSubmit).toHaveBeenCalledWith({ kind: "category", category: "quotes", days: 30 });
  });

  it("initialQuery로 초기 상태를 채운다", () => {
    setup({ initialQuery: { kind: "custom", q: "자취 요리", days: 90 } });

    expect(input()).toHaveValue("자취 요리");
    expect(screen.getByRole("combobox", { name: "기간" })).toHaveValue("90");
  });

  it("category initialQuery면 그 카테고리가 선택된다", () => {
    setup({ initialQuery: { kind: "category", category: "quotes", days: 7 } });

    expect(categoryButton("명언")).toHaveAttribute("aria-pressed", "true");
    expect(input()).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "기간" })).toHaveValue("7");
  });

  it("loading이면 버튼이 disabled이고 제출되지 않는다", async () => {
    const { onSubmit, user } = setup({ loading: true });

    expect(submitButton()).toBeDisabled();
    expect(submitButton()).toHaveTextContent("분석 중…");

    await user.click(submitButton());
    await user.type(input(), "아침 루틴{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("loading이 아니면 버튼 텍스트는 분석하기", () => {
    setup();

    expect(submitButton()).toBeEnabled();
    expect(submitButton()).toHaveTextContent("분석하기");
  });
});
