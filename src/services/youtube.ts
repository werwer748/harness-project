import { parseIsoDuration } from "@/lib/duration";
import type { ShortVideo } from "@/types";

export const MAX_SHORT_DURATION_SEC = 180;

const API_BASE = "https://www.googleapis.com/youtube/v3";
const DEFAULT_MAX_RESULTS = 25;
const VIDEOS_BATCH_SIZE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
const FETCH_INIT: RequestInit = { next: { revalidate: 600 } };

export type YouTubeErrorCode =
  | "MISSING_API_KEY"
  | "QUOTA_EXCEEDED"
  | "INVALID_KEY"
  | "API_NOT_ENABLED"
  | "UPSTREAM_ERROR";

// message에는 요청 URL·API 키·YouTube 원본 에러 문구를 넣지 않는다.
const ERROR_MESSAGES: Record<YouTubeErrorCode, string> = {
  MISSING_API_KEY:
    "YouTube API 키가 설정되지 않았습니다. 서버 환경 변수 YOUTUBE_API_KEY를 확인해 주세요.",
  QUOTA_EXCEEDED:
    "YouTube API 사용량 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.",
  INVALID_KEY: "YouTube API 키가 올바르지 않습니다.",
  API_NOT_ENABLED:
    "Google Cloud 프로젝트에서 YouTube Data API v3가 사용 설정되어 있지 않습니다.",
  UPSTREAM_ERROR: "YouTube API 요청을 처리하지 못했습니다.",
};

export class YouTubeApiError extends Error {
  constructor(
    public readonly code: YouTubeErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

export interface FetchShortsOptions {
  queries: string[]; // 카테고리 시드 3개 또는 사용자 키워드 1개
  days: number; // 7 | 30 | 90
  now: Date;
  maxResultsPerQuery?: number; // 기본 25
}

interface YouTubeThumbnail {
  url?: string;
}

interface YouTubeVideoSnippet {
  title?: string;
  description?: string;
  channelId?: string;
  channelTitle?: string;
  publishedAt?: string;
  tags?: string[];
  liveBroadcastContent?: string;
  thumbnails?: {
    default?: YouTubeThumbnail;
    medium?: YouTubeThumbnail;
    high?: YouTubeThumbnail;
  };
}

// videos.list 응답의 items[] 중 사용하는 필드만
export interface YouTubeVideoItem {
  id: string;
  snippet?: YouTubeVideoSnippet;
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
}

interface SearchListResponse {
  items?: { id?: { videoId?: string } }[];
}

interface VideoListResponse {
  items?: YouTubeVideoItem[];
}

const QUOTA_REASONS = ["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"];
const INVALID_KEY_REASONS = ["keyInvalid", "API_KEY_INVALID"];
const NOT_ENABLED_REASONS = ["accessNotConfigured", "SERVICE_DISABLED"];

export async function fetchShorts(options: FetchShortsOptions): Promise<ShortVideo[]> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) throw createError("MISSING_API_KEY");

  const publishedAfter = toRfc3339(
    new Date(options.now.getTime() - options.days * DAY_MS),
  );
  const maxResults = String(options.maxResultsPerQuery ?? DEFAULT_MAX_RESULTS);

  const searchPages = await Promise.all(
    options.queries.map((q) =>
      requestJson<SearchListResponse>("search", {
        part: "snippet",
        type: "video",
        videoDuration: "short",
        regionCode: "KR",
        relevanceLanguage: "ko",
        order: "viewCount",
        maxResults,
        q,
        publishedAfter,
        key,
      }),
    ),
  );

  // search 결과의 제목은 HTML 이스케이프되어 있어 videoId만 쓴다
  const ids = new Set<string>();
  for (const page of searchPages) {
    for (const item of page.items ?? []) {
      if (item.id?.videoId) ids.add(item.id.videoId);
    }
  }

  const videoPages = await Promise.all(
    chunk([...ids], VIDEOS_BATCH_SIZE).map((batch) =>
      requestJson<VideoListResponse>("videos", {
        part: "snippet,statistics,contentDetails",
        id: batch.join(","),
        key,
      }),
    ),
  );

  return videoPages
    .flatMap((page) => page.items ?? [])
    .filter((item) => item.snippet?.liveBroadcastContent === "none")
    .map(toShortVideo)
    .filter(
      (video) =>
        video.durationSec >= 1 && video.durationSec <= MAX_SHORT_DURATION_SEC,
    );
}

export function toShortVideo(item: YouTubeVideoItem): ShortVideo {
  const snippet: YouTubeVideoSnippet = item.snippet ?? {};
  const thumbnails = snippet.thumbnails ?? {};

  return {
    id: item.id,
    title: snippet.title ?? "",
    description: snippet.description ?? "",
    channelId: snippet.channelId ?? "",
    channelTitle: snippet.channelTitle ?? "",
    publishedAt: snippet.publishedAt ?? "",
    thumbnailUrl:
      thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || "",
    tags: snippet.tags ?? [],
    durationSec: parseIsoDuration(item.contentDetails?.duration ?? ""),
    viewCount: toCount(item.statistics?.viewCount),
    likeCount: toCount(item.statistics?.likeCount),
    commentCount: toCount(item.statistics?.commentCount),
  };
}

async function requestJson<T>(
  endpoint: "search" | "videos",
  params: Record<string, string>,
): Promise<T> {
  const url = `${API_BASE}/${endpoint}?${new URLSearchParams(params)}`;

  let response: Response;
  try {
    response = await fetch(url, FETCH_INIT);
  } catch {
    // 네트워크 예외 메시지에 URL이 들어갈 수 있어 원본을 버린다
    throw createError("UPSTREAM_ERROR");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw createError("UPSTREAM_ERROR", response.status);
  }

  if (!response.ok) throw createError(classifyError(body), response.status);
  if (typeof body !== "object" || body === null) {
    throw createError("UPSTREAM_ERROR", response.status);
  }
  return body as T;
}

// HTTP status가 아니라 error.errors[].reason과 error.details[].reason으로 판단한다
function classifyError(body: unknown): YouTubeErrorCode {
  const error = (body as { error?: { errors?: unknown; details?: unknown } } | null)
    ?.error;
  const reasons = [...reasonsOf(error?.errors), ...reasonsOf(error?.details)];
  const hasAny = (candidates: string[]) =>
    reasons.some((reason) => candidates.includes(reason));

  if (hasAny(QUOTA_REASONS)) return "QUOTA_EXCEEDED";
  if (hasAny(INVALID_KEY_REASONS)) return "INVALID_KEY";
  if (hasAny(NOT_ENABLED_REASONS)) return "API_NOT_ENABLED";
  return "UPSTREAM_ERROR";
}

function reasonsOf(entries: unknown): string[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => entry?.reason)
    .filter((reason): reason is string => typeof reason === "string");
}

function createError(code: YouTubeErrorCode, status?: number): YouTubeApiError {
  return new YouTubeApiError(code, ERROR_MESSAGES[code], status);
}

function toCount(value: string | undefined): number {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}

function toRfc3339(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
