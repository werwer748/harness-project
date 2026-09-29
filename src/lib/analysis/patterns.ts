import type {
  DurationBucket,
  DurationBucketStat,
  ScoredVideo,
  TitlePattern,
  TitlePatternStat,
} from "@/types";
import { median } from "./metrics";

const SHORT_TITLE_MAX_LENGTH = 20;
const HASHTAG = /#[^\s#]*/g;
const QUESTION_ENDINGS = ["까", "나요", "는가"];
const HOWTO_PHRASES = ["방법", "하는 법", "하는법", "꿀팁", "노하우"];

const TITLE_PATTERNS: {
  pattern: TitlePattern;
  label: string;
  matches: (title: string) => boolean;
}[] = [
  { pattern: "number", label: "숫자 포함", matches: (title) => /\d/.test(title) },
  {
    pattern: "question",
    label: "질문형",
    matches: (title) => {
      const body = stripHashtags(title);
      return (
        title.includes("?") ||
        QUESTION_ENDINGS.some((ending) => body.endsWith(ending))
      );
    },
  },
  {
    pattern: "howto",
    label: "방법·꿀팁형",
    matches: (title) => HOWTO_PHRASES.some((phrase) => title.includes(phrase)),
  },
  {
    pattern: "short-title",
    label: "20자 이하 짧은 제목",
    // 이모지가 두 글자로 세어지지 않도록 코드 포인트 단위로 센다
    matches: (title) => [...stripHashtags(title)].length <= SHORT_TITLE_MAX_LENGTH,
  },
];

const DURATION_BUCKETS: {
  bucket: DurationBucket;
  label: string;
  maxSec: number;
}[] = [
  { bucket: "0-15", label: "15초 이하", maxSec: 15 },
  { bucket: "16-30", label: "16–30초", maxSec: 30 },
  { bucket: "31-60", label: "31–60초", maxSec: 60 },
  { bucket: "61-180", label: "61초–3분", maxSec: 180 },
];

export function analyzeTitlePatterns(videos: ScoredVideo[]): TitlePatternStat[] {
  const overallMedian = median(videos.map((video) => video.viewsPerDay));

  return TITLE_PATTERNS.map(({ pattern, label, matches }) => {
    const group = summarizeGroup(
      videos.filter((video) => matches(video.title)),
      videos.length,
    );
    return {
      pattern,
      label,
      ...group,
      lift: overallMedian > 0 ? group.medianViewsPerDay / overallMedian : 0,
    };
  });
}

export function analyzeDurationBuckets(
  videos: ScoredVideo[],
): DurationBucketStat[] {
  return DURATION_BUCKETS.map(({ bucket, label }) => ({
    bucket,
    label,
    ...summarizeGroup(
      videos.filter((video) => bucketOf(video.durationSec) === bucket),
      videos.length,
    ),
  }));
}

// 해시태그를 모두 뺀 제목 본문 (NFD 제목도 글자 수가 같게 세어지도록 NFC로 맞춘다)
function stripHashtags(title: string): string {
  return title.normalize("NFC").replace(HASHTAG, " ").replace(/\s+/g, " ").trim();
}

function bucketOf(durationSec: number): DurationBucket | undefined {
  return DURATION_BUCKETS.find(({ maxSec }) => durationSec <= maxSec)?.bucket;
}

function summarizeGroup(group: ScoredVideo[], total: number) {
  return {
    videoCount: group.length,
    share: total > 0 ? group.length / total : 0,
    medianViewsPerDay: median(group.map((video) => video.viewsPerDay)),
  };
}
