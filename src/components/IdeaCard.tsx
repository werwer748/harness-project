"use client";

import { useId } from "react";
import { formatCount, formatMultiplier } from "@/lib/format";
import type { ContentIdea } from "@/types";

interface IdeaCardProps {
  idea: ContentIdea;
  saved: boolean;
  onToggleSave: (idea: ContentIdea) => void;
}

const HIGHLIGHT_OPPORTUNITY = 1.5;

export default function IdeaCard({ idea, saved, onToggleSave }: IdeaCardProps) {
  const headingId = useId();
  const titlesId = useId();

  return (
    <article
      aria-labelledby={headingId}
      className="rounded-lg bg-[#141414] border border-neutral-800 p-5 flex flex-col gap-3"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 id={headingId} className="text-base font-semibold text-white">
            {idea.keyword}
          </h3>
          {/* fallback의 opportunity 0은 성과가 나쁘다는 뜻이 아니라 데이터가 없다는 뜻이다 */}
          {idea.fallback ? (
            <span className="text-xs text-neutral-500">기본 제안</span>
          ) : (
            <p className="text-xs text-neutral-400">
              기회 지수{" "}
              <span
                className={`text-sm font-semibold tabular-nums ${
                  idea.opportunity >= HIGHLIGHT_OPPORTUNITY ? "text-amber-400" : "text-white"
                }`}
              >
                {formatMultiplier(idea.opportunity)}
              </span>
            </p>
          )}
        </div>
        <button
          type="button"
          aria-pressed={saved}
          onClick={() => onToggleSave(idea)}
          className={`shrink-0 rounded-md border px-3 py-1 text-sm transition-colors ${
            saved
              ? "border-amber-400 text-amber-400"
              : "border-neutral-800 text-neutral-400 hover:text-neutral-300"
          }`}
        >
          {saved ? "저장됨" : "저장"}
        </button>
      </header>

      <div className="flex flex-col gap-1">
        <p id={titlesId} className="text-xs text-neutral-500">
          제목 후보
        </p>
        <ol
          aria-labelledby={titlesId}
          className="list-decimal pl-5 text-sm text-neutral-300 leading-relaxed"
        >
          {idea.titles.map((title, index) => (
            <li key={index}>{title}</li>
          ))}
        </ol>
      </div>

      <p className="text-sm text-neutral-300 leading-relaxed">
        <span className="text-neutral-500">첫 3초:</span> {idea.hook}
      </p>

      <p className="text-xs text-neutral-400 leading-relaxed">{idea.reason}</p>

      {idea.referenceVideos.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-neutral-800 pt-3">
          <p className="text-xs text-neutral-500">참고 영상</p>
          <ul className="flex flex-col gap-1">
            {idea.referenceVideos.map((video) => (
              <li key={video.id} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 truncate">
                  <a
                    href={`https://www.youtube.com/shorts/${encodeURIComponent(video.id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-300 hover:text-white transition-colors"
                  >
                    {video.title}
                  </a>
                  <span className="text-neutral-500"> · {video.channelTitle}</span>
                </span>
                <span className="shrink-0 text-neutral-400 tabular-nums">
                  조회수 {formatCount(video.viewCount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
