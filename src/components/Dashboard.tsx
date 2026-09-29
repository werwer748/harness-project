"use client";

import { useEffect, useId, useRef, useState } from "react";
import { isIdeaSaved, loadSavedIdeas, removeIdea, saveIdea } from "@/lib/savedIdeas";
import { toTrendSearchParams } from "@/lib/trendQuery";
import type { ApiErrorBody, ContentIdea, SavedIdea, TrendQuery, TrendReport } from "@/types";
import IdeaCard from "./IdeaCard";
import KeywordTable from "./KeywordTable";
import PatternStats from "./PatternStats";
import SavedIdeasPanel from "./SavedIdeasPanel";
import SearchControls from "./SearchControls";
import SummaryStats from "./SummaryStats";
import TopVideosTable from "./TopVideosTable";

type ApiError = ApiErrorBody["error"];
type RequestResult = { ok: true; report: TrendReport } | { ok: false; error: ApiError };

const PARSE_ERROR: ApiError = { code: "INTERNAL_ERROR", message: "요청을 처리하지 못했습니다" };
const NETWORK_ERROR: ApiError = {
  code: "INTERNAL_ERROR",
  message: "서버에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도하세요.",
};

const CARD = "rounded-lg bg-[#141414] border border-neutral-800 p-5";

async function requestReport(query: TrendQuery): Promise<RequestResult> {
  let res: Response;
  try {
    res = await fetch(`/api/trends?${toTrendSearchParams(query)}`);
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: PARSE_ERROR };
  }
  if (res.ok) return { ok: true, report: body as TrendReport };
  return { ok: false, error: isApiErrorBody(body) ? body.error : PARSE_ERROR };
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null) return false;
  const { error } = value as Record<string, unknown>;
  if (typeof error !== "object" || error === null) return false;
  const { code, message } = error as Record<string, unknown>;
  return typeof code === "string" && typeof message === "string";
}

export default function Dashboard() {
  const [report, setReport] = useState<TrendReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [savedIdeas, setSavedIdeas] = useState<SavedIdea[]>([]);
  // 가장 최근 요청의 번호. 응답이 왔을 때 번호가 다르면 이전 요청이므로 버린다
  const latestRequestId = useRef(0);

  // 서버 렌더와 첫 클라이언트 렌더가 같아야 하므로 localStorage는 마운트 뒤에만 읽는다
  useEffect(() => {
    setSavedIdeas(loadSavedIdeas());
  }, []);

  async function handleSubmit(query: TrendQuery) {
    const requestId = ++latestRequestId.current;
    setLoading(true);
    setError(null);
    setReport(null);

    const result = await requestReport(query);
    if (requestId !== latestRequestId.current) return;

    if (result.ok) setReport(result.report);
    else setError(result.error);
    setLoading(false);
  }

  function handleToggleSave(idea: ContentIdea) {
    setSavedIdeas(
      isIdeaSaved(savedIdeas, idea.id) ? removeIdea(idea.id) : saveIdea(idea, new Date()),
    );
  }

  function handleRemove(id: string) {
    setSavedIdeas(removeIdea(id));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="min-w-0 space-y-8">
        <SearchControls loading={loading} onSubmit={handleSubmit} />
        {loading ? (
          <ResultsSkeleton />
        ) : error ? (
          <ErrorMessage error={error} />
        ) : report ? (
          <ReportView report={report} savedIdeas={savedIdeas} onToggleSave={handleToggleSave} />
        ) : (
          <p className={`${CARD} text-sm text-neutral-400`}>카테고리를 고르고 분석하기를 누르세요.</p>
        )}
      </div>
      <SavedIdeasPanel ideas={savedIdeas} onRemove={handleRemove} />
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div role="status" className="space-y-8">
      <span className="sr-only">분석 결과를 불러오는 중…</span>
      {["h-28", "h-72", "h-56"].map((height) => (
        <div
          key={height}
          aria-hidden="true"
          className={`${height} animate-pulse rounded-lg border border-neutral-800 bg-neutral-900`}
        />
      ))}
    </div>
  );
}

function ErrorMessage({ error }: { error: ApiError }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-500/50 bg-red-500/10 p-5 flex flex-col gap-1 text-sm leading-relaxed"
    >
      <p className="text-red-400">{error.message}</p>
      {error.code === "MISSING_API_KEY" && (
        <p className="text-neutral-300">
          <code>cp .env.example .env.local</code>로 파일을 만들고 <code>YOUTUBE_API_KEY</code>에
          키를 넣은 뒤 개발 서버를 재시작하세요.
        </p>
      )}
    </div>
  );
}

interface ReportViewProps {
  report: TrendReport;
  savedIdeas: SavedIdea[];
  onToggleSave: (idea: ContentIdea) => void;
}

function ReportView({ report, savedIdeas, onToggleSave }: ReportViewProps) {
  const ideasHeadingId = useId();

  return (
    <div className="space-y-8">
      <SummaryStats summary={report.summary} query={report.query} days={report.days} />

      <section aria-labelledby={ideasHeadingId} className="flex flex-col gap-3">
        <h2 id={ideasHeadingId} className="text-sm font-medium text-neutral-400">
          다음 콘텐츠 추천
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {report.ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              saved={isIdeaSaved(savedIdeas, idea.id)}
              onToggleSave={onToggleSave}
            />
          ))}
        </div>
      </section>

      {/* 영상이 없으면 표는 비어 있으므로 숨기고, fallback 아이디어만 남긴다 */}
      {report.summary.videoCount === 0 ? (
        <p className={`${CARD} text-sm text-neutral-400`}>
          조건에 맞는 쇼츠가 없습니다. 기간을 늘리거나 다른 키워드를 시도하세요.
        </p>
      ) : (
        <>
          <KeywordTable keywords={report.keywords} />
          <PatternStats
            titlePatterns={report.titlePatterns}
            durationBuckets={report.durationBuckets}
          />
          <TopVideosTable videos={report.topVideos} />
        </>
      )}
    </div>
  );
}
