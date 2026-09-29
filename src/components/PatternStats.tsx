import { useId } from "react";
import { formatCount, formatMultiplier, formatPercent } from "@/lib/format";
import type { DurationBucketStat, TitlePatternStat } from "@/types";

interface PatternStatsProps {
  titlePatterns: TitlePatternStat[];
  durationBuckets: DurationBucketStat[];
}

// 0~1 비중을 막대 너비(%)로 바꾼다. 범위를 벗어나거나 유한하지 않으면 0~100으로 제한한다
function barWidth(share: number): string {
  const ratio = Number.isFinite(share) ? Math.min(Math.max(share, 0), 1) : 0;
  return `${ratio * 100}%`;
}

// lift가 가장 높은 행의 위치. 동점이면 먼저 나온 행, 모두 0 이하(영상 0개)면 -1
function topLiftIndex(stats: TitlePatternStat[]): number {
  let best = -1;
  stats.forEach((stat, index) => {
    if (stat.lift > 0 && (best === -1 || stat.lift > stats[best].lift)) best = index;
  });
  return best;
}

function ShareBar({ share, highlight }: { share: number; highlight: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden="true" className="h-1.5 w-24 shrink-0">
        <div
          data-testid="share-bar"
          className={`h-full ${highlight ? "bg-amber-400" : "bg-neutral-700"}`}
          style={{ width: barWidth(share) }}
        />
      </div>
      <span className="text-neutral-300">{formatPercent(share)}</span>
    </div>
  );
}

const HEADER_ROW = "border-b border-neutral-800 text-xs text-neutral-500";
const HEADER_CELL = "whitespace-nowrap py-2 font-normal";
const BODY_ROW = "border-b border-neutral-800 last:border-b-0";

export default function PatternStats({ titlePatterns, durationBuckets }: PatternStatsProps) {
  const titleHeadingId = useId();
  const durationHeadingId = useId();
  const highlightIndex = topLiftIndex(titlePatterns);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <section className="rounded-lg bg-[#141414] border border-neutral-800 p-5 flex flex-col gap-3">
        <h2 id={titleHeadingId} className="text-sm font-medium text-neutral-400">
          제목 패턴
        </h2>
        <div className="overflow-x-auto">
          <table aria-labelledby={titleHeadingId} className="w-full text-sm">
            <thead>
              <tr className={HEADER_ROW}>
                <th scope="col" className={`${HEADER_CELL} pr-3 text-left`}>
                  패턴
                </th>
                <th scope="col" className={`${HEADER_CELL} px-3 text-left`}>
                  비중
                </th>
                <th scope="col" className={`${HEADER_CELL} px-3 text-right`}>
                  일평균 조회수(중앙값)
                </th>
                <th scope="col" className={`${HEADER_CELL} pl-3 text-right`}>
                  lift
                </th>
              </tr>
            </thead>
            <tbody>
              {titlePatterns.map((stat, index) => {
                const highlight = index === highlightIndex;
                return (
                  <tr
                    key={stat.pattern}
                    data-highlight={highlight ? "true" : undefined}
                    className={BODY_ROW}
                  >
                    <td className="py-2 pr-3 text-white">{stat.label}</td>
                    <td className="py-2 px-3 tabular-nums">
                      <ShareBar share={stat.share} highlight={highlight} />
                    </td>
                    <td className="py-2 px-3 text-right text-neutral-300 tabular-nums">
                      {formatCount(stat.medianViewsPerDay)}
                    </td>
                    <td
                      className={`py-2 pl-3 text-right font-semibold tabular-nums ${
                        highlight ? "text-amber-400" : "text-white"
                      }`}
                    >
                      {formatMultiplier(stat.lift)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg bg-[#141414] border border-neutral-800 p-5 flex flex-col gap-3">
        <h2 id={durationHeadingId} className="text-sm font-medium text-neutral-400">
          영상 길이
        </h2>
        <div className="overflow-x-auto">
          <table aria-labelledby={durationHeadingId} className="w-full text-sm">
            <thead>
              <tr className={HEADER_ROW}>
                <th scope="col" className={`${HEADER_CELL} pr-3 text-left`}>
                  구간
                </th>
                <th scope="col" className={`${HEADER_CELL} px-3 text-left`}>
                  비중
                </th>
                <th scope="col" className={`${HEADER_CELL} pl-3 text-right`}>
                  일평균 조회수(중앙값)
                </th>
              </tr>
            </thead>
            <tbody>
              {durationBuckets.map((stat) => (
                <tr key={stat.bucket} className={BODY_ROW}>
                  <td className="py-2 pr-3 text-white">{stat.label}</td>
                  <td className="py-2 px-3 tabular-nums">
                    <ShareBar share={stat.share} highlight={false} />
                  </td>
                  <td className="py-2 pl-3 text-right text-neutral-300 tabular-nums">
                    {formatCount(stat.medianViewsPerDay)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
