import Image from "next/image";
import { useId } from "react";
import {
  formatCount,
  formatDate,
  formatDuration,
  formatPercent,
} from "@/lib/format";
import type { ScoredVideo } from "@/types";

interface TopVideosTableProps {
  videos: ScoredVideo[];
}

// next.config.ts의 images.remotePatterns에 등록된 호스트
const OPTIMIZED_THUMBNAIL_HOST = "i.ytimg.com";

const NUMERIC_COLUMNS = ["조회수", "일평균 조회수", "참여율", "길이", "게시일"];

// https URL이 아니면 null. remotePatterns에 없는 호스트를 최적화 경로로 부르면 런타임 에러가 나므로
// i.ytimg.com만 최적화하고 나머지는 원본 URL을 그대로 쓴다
function parseThumbnail(url: string): { src: string; unoptimized: boolean } | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  return { src: url, unoptimized: parsed.hostname !== OPTIMIZED_THUMBNAIL_HOST };
}

function Thumbnail({ video }: { video: ScoredVideo }) {
  const thumbnail = parseThumbnail(video.thumbnailUrl);
  if (!thumbnail) {
    return (
      <div
        aria-hidden="true"
        data-testid="thumbnail-placeholder"
        className="h-16 w-9 rounded-sm bg-neutral-800"
      />
    );
  }
  return (
    <Image
      src={thumbnail.src}
      alt={video.title}
      width={36}
      height={64}
      unoptimized={thumbnail.unoptimized}
      className="h-16 w-9 rounded-sm bg-neutral-800 object-cover"
    />
  );
}

export default function TopVideosTable({ videos }: TopVideosTableProps) {
  const headingId = useId();

  return (
    <section className="rounded-lg bg-[#141414] border border-neutral-800 p-5 flex flex-col gap-3">
      <h2 id={headingId} className="text-sm font-medium text-neutral-400">
        잘 되는 쇼츠 TOP {videos.length}
      </h2>
      {videos.length === 0 ? (
        <p className="text-sm text-neutral-500">조건에 맞는 쇼츠가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table aria-labelledby={headingId} className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-xs text-neutral-500">
                <th scope="col" className="py-2 pr-3 text-left font-normal">
                  <span className="sr-only">썸네일</span>
                </th>
                <th scope="col" className="py-2 px-3 text-left font-normal">
                  제목
                </th>
                {NUMERIC_COLUMNS.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="whitespace-nowrap py-2 pl-3 text-right font-normal"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr key={video.id} className="border-b border-neutral-800 last:border-b-0">
                  <td className="py-2 pr-3">
                    <Thumbnail video={video} />
                  </td>
                  <td className="min-w-48 py-2 px-3">
                    <div className="flex flex-col gap-0.5">
                      <a
                        href={`https://www.youtube.com/shorts/${encodeURIComponent(video.id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-300 hover:text-white transition-colors"
                      >
                        {video.title}
                      </a>
                      <span className="text-xs text-neutral-500">{video.channelTitle}</span>
                    </div>
                  </td>
                  <td className="py-2 pl-3 text-right text-neutral-300 tabular-nums">
                    {formatCount(video.viewCount)}
                  </td>
                  <td className="py-2 pl-3 text-right font-semibold text-white tabular-nums">
                    {formatCount(video.viewsPerDay)}
                  </td>
                  <td className="py-2 pl-3 text-right text-neutral-300 tabular-nums">
                    {formatPercent(video.engagementRate)}
                  </td>
                  <td className="whitespace-nowrap py-2 pl-3 text-right text-neutral-300 tabular-nums">
                    {formatDuration(video.durationSec)}
                  </td>
                  <td className="whitespace-nowrap py-2 pl-3 text-right text-neutral-400 tabular-nums">
                    <time dateTime={video.publishedAt}>{formatDate(video.publishedAt)}</time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
