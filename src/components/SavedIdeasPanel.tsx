"use client";

import { formatDate } from "@/lib/format";
import type { SavedIdea } from "@/types";

interface SavedIdeasPanelProps {
  ideas: SavedIdea[];
  onRemove: (id: string) => void;
}

export default function SavedIdeasPanel({ ideas, onRemove }: SavedIdeasPanelProps) {
  return (
    <section className="rounded-lg bg-[#141414] border border-neutral-800 p-5 flex flex-col gap-3">
      <h2 className="text-sm font-medium text-neutral-400">
        저장한 아이디어 ({ideas.length})
      </h2>
      {ideas.length === 0 ? (
        <p className="text-sm text-neutral-500">
          저장한 아이디어가 없습니다. 추천 카드에서 저장을 눌러 보세요.
        </p>
      ) : (
        <ul className="flex flex-col">
          {ideas.map((idea) => (
            <li
              key={idea.id}
              className="flex items-start justify-between gap-3 border-b border-neutral-800 py-2 last:border-b-0"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium text-white">{idea.keyword}</span>
                {idea.titles[0] && (
                  <span className="text-sm text-neutral-300">{idea.titles[0]}</span>
                )}
                <time dateTime={idea.savedAt} className="text-xs text-neutral-500 tabular-nums">
                  {formatDate(idea.savedAt)}
                </time>
              </div>
              <button
                type="button"
                onClick={() => onRemove(idea.id)}
                aria-label={`${idea.keyword} 삭제`}
                className="shrink-0 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
