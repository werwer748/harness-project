import { getTemplateSet } from "@/lib/categories";
import type {
  ContentIdea,
  KeywordStat,
  ReferenceVideo,
  ReportScope,
  ScoredVideo,
  TemplateSet,
} from "@/types";
import { compareByViewsPerDay, median } from "./metrics";

const DEFAULT_IDEA_COUNT = 5;
const REFERENCE_VIDEO_COUNT = 3;
const TITLE_COUNT = 3;
const KEYWORD_PLACEHOLDER = "{keyword}";
const FALLBACK_REASON = "수집된 데이터가 부족해 기본 주제로 제안합니다";

// FNV-1a 32bit: 같은 키워드면 실행 환경과 관계없이 같은 템플릿을 고른다
export function stableHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface BuildIdeasInput {
  scope: ReportScope;
  keywords: KeywordStat[]; // 이미 정렬된 상태
  videos: ScoredVideo[];
  fallbackKeywords: string[]; // 카테고리면 시드 3개, custom이면 [q]
  count?: number; // 기본 5
}

export function buildIdeas(input: BuildIdeasInput): ContentIdea[] {
  const { scope, keywords, videos, fallbackKeywords } = input;
  const count = input.count ?? DEFAULT_IDEA_COUNT;
  const templates = getTemplateSet(scope);
  const videosById = new Map(videos.map((video) => [video.id, video]));
  const globalMedian = median(videos.map((video) => video.viewsPerDay));

  const ideas: ContentIdea[] = [];
  const used = new Set<string>();

  for (const stat of keywords) {
    if (ideas.length >= count) break;
    if (used.has(stat.keyword)) continue;
    used.add(stat.keyword);

    const matched = stat.videoIds.flatMap((id) => videosById.get(id) ?? []);
    ideas.push({
      ...fillTemplates(scope, stat.keyword, templates),
      reason: keywordReason(stat, globalMedian),
      opportunity: stat.opportunity,
      referenceVideos: topReferences(matched),
      fallback: false,
    });
  }

  for (const rawKeyword of fallbackKeywords) {
    if (ideas.length >= count) break;
    const keyword = rawKeyword.trim();
    if (!keyword || used.has(keyword)) continue;
    used.add(keyword);

    ideas.push({
      ...fillTemplates(scope, keyword, templates),
      reason: FALLBACK_REASON,
      opportunity: 0,
      referenceVideos: topReferences(videos),
      fallback: true,
    });
  }

  return ideas;
}

function fillTemplates(scope: ReportScope, keyword: string, templates: TemplateSet) {
  const { titleTemplates, hookTemplates } = templates;
  const h = stableHash(keyword);
  const picked = Array.from(
    { length: TITLE_COUNT },
    (_, i) => titleTemplates[(h + i) % titleTemplates.length],
  );

  return {
    // 인덱스·날짜·난수를 넣지 않아 localStorage 중복 제거 키로 쓸 수 있다
    id: `${scope}:${keyword}:${picked[0].key}`,
    scope,
    keyword,
    titles: picked.map((template) => insertKeyword(template.text, keyword)),
    hook: insertKeyword(hookTemplates[h % hookTemplates.length], keyword),
  };
}

// String.replace는 '$&' 같은 치환 패턴을 해석하므로 split/join으로 그대로 넣는다
function insertKeyword(template: string, keyword: string): string {
  return template.split(KEYWORD_PLACEHOLDER).join(keyword);
}

function keywordReason(stat: KeywordStat, globalMedian: number): string {
  const ratio = globalMedian > 0 ? stat.medianViewsPerDay / globalMedian : 0;
  const engagementPercent = stat.avgEngagementRate * 100;
  return (
    `'${stat.keyword}' 쇼츠 ${stat.videoCount}개(채널 ${stat.channelCount}곳)의 ` +
    `일평균 조회수가 전체 중앙값의 ${ratio.toFixed(1)}배, ` +
    `평균 참여율 ${engagementPercent.toFixed(1)}%`
  );
}

function topReferences(videos: ScoredVideo[]): ReferenceVideo[] {
  return [...videos]
    .sort(compareByViewsPerDay)
    .slice(0, REFERENCE_VIDEO_COUNT)
    .map(({ id, title, channelTitle, viewCount, viewsPerDay }) => ({
      id,
      title,
      channelTitle,
      viewCount,
      viewsPerDay,
    }));
}
