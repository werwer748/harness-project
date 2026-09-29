import type {
  Days,
  ReportScope,
  ReportSummary,
  ScoredVideo,
  ShortVideo,
  TrendReport,
} from "@/types";
import { extractKeywordStats } from "./keywords";
import { average, compareByViewsPerDay, median, scoreVideos } from "./metrics";
import { analyzeDurationBuckets, analyzeTitlePatterns } from "./patterns";
import { buildIdeas } from "./recommend";

const TOP_VIDEO_COUNT = 20;

export interface AnalyzeOptions {
  scope: ReportScope;
  query: string;
  days: Days;
  excludedTerms: ReadonlySet<string>; // 검색어 자체는 키워드에서 뺀다
  fallbackKeywords: string[]; // 카테고리면 시드 3개, custom이면 [q]
  now: Date;
}

export function analyzeShorts(
  videos: ShortVideo[],
  options: AnalyzeOptions,
): TrendReport {
  const { scope, query, days, excludedTerms, fallbackKeywords, now } = options;
  const scored = scoreVideos(videos, now);
  const summary = summarize(scored);
  const keywords = extractKeywordStats(scored, {
    excludedTerms,
    globalMedianViewsPerDay: summary.medianViewsPerDay,
  });

  return {
    scope,
    query,
    days,
    generatedAt: now.toISOString(),
    summary,
    ideas: buildIdeas({ scope, keywords, videos: scored, fallbackKeywords }),
    keywords,
    titlePatterns: analyzeTitlePatterns(scored),
    durationBuckets: analyzeDurationBuckets(scored),
    topVideos: [...scored].sort(compareByViewsPerDay).slice(0, TOP_VIDEO_COUNT),
  };
}

function summarize(videos: ScoredVideo[]): ReportSummary {
  return {
    videoCount: videos.length,
    channelCount: new Set(videos.map((video) => video.channelId)).size,
    medianViews: median(videos.map((video) => video.viewCount)),
    medianViewsPerDay: median(videos.map((video) => video.viewsPerDay)),
    avgEngagementRate: average(videos.map((video) => video.engagementRate)),
    avgDurationSec: average(videos.map((video) => video.durationSec)),
  };
}
