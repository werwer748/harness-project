import { CATEGORY_IDS, DAYS_OPTIONS, isCategoryId } from "@/lib/categories";
import type { Days, TrendQuery } from "@/types";

// 클라이언트(요청 생성)와 서버(요청 검증)가 함께 쓰는 /api/trends 쿼리 규약

export const MAX_QUERY_LENGTH = 50;
const DEFAULT_DAYS: Days = 30;

export type ParseResult =
  | { ok: true; query: TrendQuery }
  | { ok: false; message: string };

export function parseTrendQuery(params: URLSearchParams): ParseResult {
  const days = parseDays(params.get("days"));
  if (days === null) {
    return { ok: false, message: `days는 ${DAYS_OPTIONS.join(", ")} 중 하나여야 합니다` };
  }

  // q가 있으면 category는 보지 않는다
  const q = params.get("q")?.trim() ?? "";
  if (q) {
    // 코드 포인트 기준으로 센다
    if ([...q].length > MAX_QUERY_LENGTH) {
      return { ok: false, message: `q는 ${MAX_QUERY_LENGTH}자 이하여야 합니다` };
    }
    return { ok: true, query: { kind: "custom", q, days } };
  }

  const category = params.get("category");
  if (category === null) {
    return { ok: false, message: "category 또는 q 중 하나를 지정해야 합니다" };
  }
  if (!isCategoryId(category)) {
    return {
      ok: false,
      message: `category는 ${CATEGORY_IDS.join(", ")} 중 하나여야 합니다`,
    };
  }
  return { ok: true, query: { kind: "category", category, days } };
}

export function toTrendSearchParams(query: TrendQuery): URLSearchParams {
  return new URLSearchParams(
    query.kind === "custom"
      ? { q: query.q, days: String(query.days) }
      : { category: query.category, days: String(query.days) },
  );
}

// '7.0'·'07' 같은 변형은 받지 않는다
function parseDays(raw: string | null): Days | null {
  if (raw === null) return DEFAULT_DAYS;
  return DAYS_OPTIONS.find((days) => String(days) === raw) ?? null;
}
