import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatDate,
  formatDuration,
  formatMultiplier,
  formatPercent,
} from "./format";

const NON_FINITE = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

describe("formatCount", () => {
  it("ko-KR compact 표기로 줄인다", () => {
    expect(formatCount(1234)).toBe("1.2천");
    expect(formatCount(15300)).toBe("1.5만");
    expect(formatCount(123456789)).toBe("1.2억");
  });

  it("1000 미만은 그대로 둔다", () => {
    expect(formatCount(999)).toBe("999");
    expect(formatCount(7)).toBe("7");
    expect(formatCount(0)).toBe("0");
  });

  it.each(NON_FINITE)("%s이면 '-'", (value) => {
    expect(formatCount(value)).toBe("-");
  });
});

describe("formatPercent", () => {
  it("비율을 소수 첫째 자리 퍼센트로 바꾼다", () => {
    expect(formatPercent(0.0421)).toBe("4.2%");
    expect(formatPercent(0.05)).toBe("5.0%");
    expect(formatPercent(0)).toBe("0.0%");
    expect(formatPercent(1)).toBe("100.0%");
  });

  it.each(NON_FINITE)("%s이면 '-'", (value) => {
    expect(formatPercent(value)).toBe("-");
  });
});

describe("formatDuration", () => {
  it("60초 미만은 초만 쓴다", () => {
    expect(formatDuration(45)).toBe("45초");
    expect(formatDuration(0)).toBe("0초");
  });

  it("60초 이상은 분과 초로 나눈다", () => {
    expect(formatDuration(125)).toBe("2분 5초");
    expect(formatDuration(180)).toBe("3분");
  });

  it("소수는 반올림한 뒤 나눈다", () => {
    expect(formatDuration(47.6)).toBe("48초");
    expect(formatDuration(59.6)).toBe("1분");
  });

  it.each([...NON_FINITE, -1])("%s이면 '-'", (value) => {
    expect(formatDuration(value)).toBe("-");
  });
});

describe("formatMultiplier", () => {
  it("×와 소수 첫째 자리로 쓴다", () => {
    expect(formatMultiplier(1.8)).toBe("×1.8");
    expect(formatMultiplier(1.29)).toBe("×1.3");
    expect(formatMultiplier(2)).toBe("×2.0");
    expect(formatMultiplier(0)).toBe("×0.0");
  });

  it.each(NON_FINITE)("%s이면 '-'", (value) => {
    expect(formatMultiplier(value)).toBe("-");
  });
});

describe("formatDate", () => {
  it("UTC 기준 YYYY.MM.DD로 쓴다", () => {
    expect(formatDate("2026-09-28T10:00:00.000Z")).toBe("2026.09.28");
    expect(formatDate("2026-01-05T00:00:00Z")).toBe("2026.01.05");
  });

  it("로컬 시간대가 아니라 UTC 날짜를 쓴다", () => {
    expect(formatDate("2026-09-28T23:30:00Z")).toBe("2026.09.28");
    expect(formatDate("2026-09-29T08:00:00+09:00")).toBe("2026.09.28");
  });

  it.each(["", "abc", "2026-13-45T00:00:00Z"])("잘못된 값 %j이면 '-'", (value) => {
    expect(formatDate(value)).toBe("-");
  });
});
