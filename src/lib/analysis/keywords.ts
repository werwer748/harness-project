import type { KeywordStat, ScoredVideo } from "@/types";
import { average, median } from "./metrics";
import { buildVocabulary, extractVideoTerms } from "./tokenize";

export interface KeywordOptions {
  excludedTerms: ReadonlySet<string>;
  globalMedianViewsPerDay: number;
  minVideos?: number; // 기본 2
  minChannels?: number; // 기본 2
  limit?: number; // 기본 20
}

// 영상이 적은 키워드일수록 전체 중앙값 쪽으로 끌어당긴다 (가상의 전체 평균 영상 K개를 더하는 셈)
const SHRINKAGE_K = 3;

export function extractKeywordStats(
  videos: ScoredVideo[],
  options: KeywordOptions,
): KeywordStat[] {
  const {
    excludedTerms,
    globalMedianViewsPerDay: global,
    minVideos = 2,
    minChannels = 2,
    limit = 20,
  } = options;

  const vocabulary = buildVocabulary(
    videos.flatMap((video) => [video.title, ...video.tags]),
  );

  // extractVideoTerms가 영상 안에서 중복을 없애고, 같은 id의 영상은 한 번만 센다
  const videosByTerm = new Map<string, Map<string, ScoredVideo>>();
  for (const video of videos) {
    for (const term of extractVideoTerms(video, vocabulary, excludedTerms)) {
      const termVideos = videosByTerm.get(term) ?? new Map<string, ScoredVideo>();
      if (!termVideos.has(video.id)) termVideos.set(video.id, video);
      videosByTerm.set(term, termVideos);
    }
  }

  const stats: KeywordStat[] = [];
  for (const [keyword, termVideos] of videosByTerm) {
    const matched = [...termVideos.values()];
    const channelCount = new Set(matched.map((video) => video.channelId)).size;
    if (matched.length < minVideos || channelCount < minChannels) continue;

    const medianViewsPerDay = median(matched.map((video) => video.viewsPerDay));
    stats.push({
      keyword,
      videoCount: matched.length,
      channelCount,
      medianViewsPerDay,
      avgEngagementRate: average(matched.map((video) => video.engagementRate)),
      opportunity: opportunityOf(medianViewsPerDay, matched.length, global),
      videoIds: matched.map((video) => video.id),
    });
  }

  return stats.sort(compareKeywordStats).slice(0, Math.max(limit, 0));
}

function opportunityOf(
  medianViewsPerDay: number,
  videoCount: number,
  global: number,
): number {
  if (!(global > 0)) return 0;
  const shrunk =
    (medianViewsPerDay * videoCount + global * SHRINKAGE_K) /
    (videoCount + SHRINKAGE_K);
  return Math.round((shrunk / global) * 100) / 100;
}

function compareKeywordStats(a: KeywordStat, b: KeywordStat): number {
  if (a.opportunity !== b.opportunity) return b.opportunity - a.opportunity;
  if (a.videoCount !== b.videoCount) return b.videoCount - a.videoCount;
  return a.keyword < b.keyword ? -1 : a.keyword > b.keyword ? 1 : 0;
}
