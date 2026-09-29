export interface ShortVideo {
  id: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string; // ISO 8601
  thumbnailUrl: string; // 없으면 ''
  tags: string[];
  durationSec: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export interface VideoMetrics {
  ageDays: number;
  viewsPerDay: number;
  engagementRate: number;
}

export type ScoredVideo = ShortVideo & VideoMetrics;
