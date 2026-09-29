import { useId } from "react";
import { formatCount, formatMultiplier, formatPercent } from "@/lib/format";
import type { KeywordStat } from "@/types";

interface KeywordTableProps {
  keywords: KeywordStat[];
}

const HIGHLIGHT_OPPORTUNITY = 1.5;
const BASELINE_OPPORTUNITY = 1;

const COLUMNS = ["영상 수", "채널 수", "일평균 조회수(중앙값)", "평균 참여율", "기회 지수"];

function opportunityClass(opportunity: number): string {
  if (opportunity >= HIGHLIGHT_OPPORTUNITY) return "text-amber-400";
  // 1 미만은 전체 중앙값보다 성과가 낮다는 뜻이다
  if (opportunity < BASELINE_OPPORTUNITY) return "text-neutral-500";
  return "text-white";
}

export default function KeywordTable({ keywords }: KeywordTableProps) {
  const headingId = useId();

  return (
    <section className="rounded-lg bg-[#141414] border border-neutral-800 p-5 flex flex-col gap-3">
      <h2 id={headingId} className="text-sm font-medium text-neutral-400">
        뜨는 키워드
      </h2>
      {keywords.length === 0 ? (
        <p className="text-sm text-neutral-500">
          2개 이상 채널에서 반복된 키워드가 아직 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table aria-labelledby={headingId} className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-xs text-neutral-500">
                <th scope="col" className="py-2 pr-3 text-left font-normal">
                  키워드
                </th>
                {COLUMNS.map((column) => (
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
              {keywords.map((stat) => (
                <tr key={stat.keyword} className="border-b border-neutral-800 last:border-b-0">
                  <td className="py-2 pr-3 font-medium text-white">{stat.keyword}</td>
                  <td className="py-2 pl-3 text-right text-neutral-300 tabular-nums">
                    {formatCount(stat.videoCount)}
                  </td>
                  <td className="py-2 pl-3 text-right text-neutral-300 tabular-nums">
                    {formatCount(stat.channelCount)}
                  </td>
                  <td className="py-2 pl-3 text-right text-neutral-300 tabular-nums">
                    {formatCount(stat.medianViewsPerDay)}
                  </td>
                  <td className="py-2 pl-3 text-right text-neutral-300 tabular-nums">
                    {formatPercent(stat.avgEngagementRate)}
                  </td>
                  <td
                    className={`py-2 pl-3 text-right font-semibold tabular-nums ${opportunityClass(
                      stat.opportunity,
                    )}`}
                  >
                    {formatMultiplier(stat.opportunity)}
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
