import { describe, expect, it } from "vitest";
import { parseIsoDuration } from "./duration";

describe("parseIsoDuration", () => {
  it.each([
    ["PT1M5S", 65],
    ["PT45S", 45],
    ["PT1H", 3600],
    ["PT3M", 180],
    ["PT1H2M3S", 3723],
    ["P1DT1S", 86401],
    ["P0D", 0],
    ["PT0S", 0],
  ])("parses %s as %i seconds", (iso, seconds) => {
    expect(parseIsoDuration(iso)).toBe(seconds);
  });

  it.each(["", "abc", "1M5S", "PT1.5S", "PT-5S", "PTXS", "pt45s", "PT45S extra"])(
    "returns 0 for malformed input %j",
    (iso) => {
      expect(parseIsoDuration(iso)).toBe(0);
    },
  );
});
