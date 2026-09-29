import { formatCount, formatDuration, formatPercent } from "@/lib/format";
import type { Days, ReportSummary } from "@/types";

interface SummaryStatsProps {
  summary: ReportSummary;
  query: string;
  days: Days;
}

export default function SummaryStats({ summary, query, days }: SummaryStatsProps) {
  const stats = [
    { label: "분석한 쇼츠", value: formatCount(summary.videoCount) },
    { label: "채널 수", value: formatCount(summary.channelCount) },
    { label: "조회수 중앙값", value: formatCount(summary.medianViews) },
    { label: "일평균 조회수 중앙값", value: formatCount(summary.medianViewsPerDay) },
    { label: "평균 참여율", value: formatPercent(summary.avgEngagementRate) },
    { label: "평균 길이", value: formatDuration(summary.avgDurationSec) },
  ];

  return (
    <section className="rounded-lg bg-[#141414] border border-neutral-800 p-5 flex flex-col gap-3">
      <h2 className="text-sm font-medium text-neutral-400">
        {query} · 최근 {days}일
      </h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="text-xs text-neutral-400">{label}</dt>
            <dd className="text-xl font-semibold text-white tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
