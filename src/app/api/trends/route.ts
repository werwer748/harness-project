import { analyzeShorts } from "@/lib/analysis";
import { toExcludedTerms } from "@/lib/analysis/tokenize";
import { CATEGORIES } from "@/lib/categories";
import { parseTrendQuery } from "@/lib/trendQuery";
import { YouTubeApiError, type YouTubeErrorCode, fetchShorts } from "@/services/youtube";
import type { ApiErrorBody, ApiErrorCode, ReportScope, TrendQuery } from "@/types";

// 요청마다 현재 시각과 API 키를 읽어야 하므로 빌드 시점에 렌더하지 않는다
export const dynamic = "force-dynamic";

const YOUTUBE_ERRORS: Record<YouTubeErrorCode, { status: number; message: string }> = {
  MISSING_API_KEY: {
    status: 500,
    message: ".env.local에 YOUTUBE_API_KEY를 설정한 뒤 개발 서버를 재시작하세요.",
  },
  QUOTA_EXCEEDED: {
    status: 429,
    message: "오늘 YouTube API 할당량을 모두 썼습니다. 내일 다시 시도하세요.",
  },
  INVALID_KEY: {
    status: 502,
    message: "YOUTUBE_API_KEY가 올바르지 않습니다. 키 값을 확인하세요.",
  },
  API_NOT_ENABLED: {
    status: 502,
    message: "Google Cloud에서 YouTube Data API v3를 사용 설정하세요.",
  },
  UPSTREAM_ERROR: {
    status: 502,
    message: "YouTube 응답을 처리하지 못했습니다. 잠시 후 다시 시도하세요.",
  },
};

const INTERNAL_ERROR_MESSAGE = "요청을 처리하는 중 서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.";

interface SearchPlan {
  scope: ReportScope;
  label: string; // 리포트에 표시할 검색 대상
  queries: string[]; // YouTube 검색어
  fallbackKeywords: string[];
}

export async function GET(request: Request): Promise<Response> {
  const parsed = parseTrendQuery(new URL(request.url).searchParams);
  if (!parsed.ok) return errorResponse("BAD_REQUEST", parsed.message, 400);

  const { days } = parsed.query;
  const { scope, label, queries, fallbackKeywords } = toSearchPlan(parsed.query);
  const now = new Date();

  try {
    const videos = await fetchShorts({ queries, days, now });
    const report = analyzeShorts(videos, {
      scope,
      query: label,
      days,
      excludedTerms: toExcludedTerms(queries),
      fallbackKeywords,
      now,
    });
    return Response.json(report);
  } catch (error) {
    const { code, status, message } =
      error instanceof YouTubeApiError
        ? { code: error.code, ...YOUTUBE_ERRORS[error.code] }
        : { code: "INTERNAL_ERROR" as const, status: 500, message: INTERNAL_ERROR_MESSAGE };
    // 원본 에러에는 요청 URL(API 키 포함)이 들어 있을 수 있어 code와 message만 남긴다
    console.error(`[api/trends] ${code}: ${message}`);
    return errorResponse(code, message, status);
  }
}

function toSearchPlan(query: TrendQuery): SearchPlan {
  if (query.kind === "custom") {
    return { scope: "custom", label: query.q, queries: [query.q], fallbackKeywords: [query.q] };
  }
  const { id, label, seedKeywords } = CATEGORIES[query.category];
  return { scope: id, label, queries: [...seedKeywords], fallbackKeywords: [...seedKeywords] };
}

function errorResponse(code: ApiErrorCode, message: string, status: number): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status });
}
