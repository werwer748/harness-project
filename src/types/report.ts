import type { Days, ReportScope } from "./category";
import type { ScoredVideo } from "./video";

export interface KeywordStat {
  keyword: string;
  videoCount: number; // 이 키워드가 등장한 서로 다른 영상 수
  channelCount: number; // 그 영상들의 서로 다른 채널 수
  medianViewsPerDay: number;
  avgEngagementRate: number; // 0~1
  opportunity: number; // 1보다 크면 전체 대비 성과가 좋음
  videoIds: string[];
}

export type TitlePattern = "number" | "question" | "howto" | "short-title";

export interface TitlePatternStat {
  pattern: TitlePattern;
  label: string;
  videoCount: number;
  share: number;
  medianViewsPerDay: number;
  lift: number;
}

export type DurationBucket = "0-15" | "16-30" | "31-60" | "61-180";

export interface DurationBucketStat {
  bucket: DurationBucket;
  label: string;
  videoCount: number;
  share: number;
  medianViewsPerDay: number;
}

export interface ReferenceVideo {
  id: string;
  title: string;
  channelTitle: string;
  viewCount: number;
  viewsPerDay: number;
}

export interface ContentIdea {
  id: string; // `${scope}:${keyword}:${templateKey}` — 결정적
  scope: ReportScope;
  keyword: string;
  titles: string[]; // 3개
  hook: string;
  reason: string; // 추천 근거 한국어 문장
  opportunity: number;
  referenceVideos: ReferenceVideo[]; // 최대 3개
  fallback: boolean; // 데이터 부족으로 기본 주제에서 만든 아이디어면 true
}

export interface SavedIdea extends ContentIdea {
  savedAt: string;
}

export interface ReportSummary {
  videoCount: number;
  channelCount: number;
  medianViews: number;
  medianViewsPerDay: number;
  avgEngagementRate: number;
  avgDurationSec: number;
}

export interface TrendReport {
  scope: ReportScope;
  query: string;
  days: Days;
  generatedAt: string;
  summary: ReportSummary;
  ideas: ContentIdea[];
  keywords: KeywordStat[];
  titlePatterns: TitlePatternStat[];
  durationBuckets: DurationBucketStat[];
  topVideos: ScoredVideo[];
}
