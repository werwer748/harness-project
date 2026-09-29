// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("renders the Shorts Idea Lab heading", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Shorts Idea Lab" }),
    ).toBeInTheDocument();
  });
});
