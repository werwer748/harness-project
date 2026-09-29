import type { ScoredVideo, ShortVideo, VideoMetrics } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_AGE_DAYS = 1;

export function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function computeMetrics(video: ShortVideo, now: Date): VideoMetrics {
  const elapsedDays = (now.getTime() - Date.parse(video.publishedAt)) / DAY_MS;
  // 잘못된 날짜는 NaN이 되므로 Math.max만으로는 하한이 걸리지 않는다
  const ageDays = Number.isFinite(elapsedDays)
    ? Math.max(elapsedDays, MIN_AGE_DAYS)
    : MIN_AGE_DAYS;

  return {
    ageDays,
    viewsPerDay: video.viewCount / ageDays,
    engagementRate:
      (video.likeCount + video.commentCount) / Math.max(video.viewCount, 1),
  };
}

export function scoreVideos(videos: ShortVideo[], now: Date): ScoredVideo[] {
  return videos.map((video) => ({ ...video, ...computeMetrics(video, now) }));
}

// viewsPerDay 내림차순, 동점이면 id 오름차순 (로케일 정렬은 환경마다 결과가 달라 `<`로 비교한다)
export function compareByViewsPerDay(
  a: Pick<ScoredVideo, "id" | "viewsPerDay">,
  b: Pick<ScoredVideo, "id" | "viewsPerDay">,
): number {
  if (a.viewsPerDay !== b.viewsPerDay) return b.viewsPerDay - a.viewsPerDay;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
