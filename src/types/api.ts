import type { CategoryId, Days } from "./category";

export type TrendQuery =
  | { kind: "category"; category: CategoryId; days: Days }
  | { kind: "custom"; q: string; days: Days };

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "MISSING_API_KEY"
  | "QUOTA_EXCEEDED"
  | "INVALID_KEY"
  | "API_NOT_ENABLED"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}
