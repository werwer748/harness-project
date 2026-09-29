"use client";

import { useState, type FormEvent } from "react";
import { CATEGORIES, CATEGORY_IDS, DAYS_OPTIONS, isDays } from "@/lib/categories";
import { MAX_QUERY_LENGTH } from "@/lib/trendQuery";
import type { CategoryId, Days, TrendQuery } from "@/types";

interface SearchControlsProps {
  initialQuery?: TrendQuery; // 기본: { kind: 'category', category: 'life-tips', days: 30 }
  loading: boolean;
  onSubmit: (query: TrendQuery) => void;
}

const DEFAULT_CATEGORY: CategoryId = "life-tips";
const DEFAULT_QUERY: TrendQuery = { kind: "category", category: DEFAULT_CATEGORY, days: 30 };

export default function SearchControls({
  initialQuery = DEFAULT_QUERY,
  loading,
  onSubmit,
}: SearchControlsProps) {
  const [category, setCategory] = useState<CategoryId>(
    initialQuery.kind === "category" ? initialQuery.category : DEFAULT_CATEGORY,
  );
  const [q, setQ] = useState(initialQuery.kind === "custom" ? initialQuery.q : "");
  const [days, setDays] = useState<Days>(initialQuery.days);

  // 입력값이 있으면 카테고리보다 우선한다 (parseTrendQuery와 같은 규칙)
  const trimmed = q.trim();
  const isCustom = trimmed !== "";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    onSubmit(isCustom ? { kind: "custom", q: trimmed, days } : { kind: "category", category, days });
  }

  // 입력값이 남아 있으면 카테고리 클릭이 제출 결과를 바꾸지 못하므로 입력을 비운다
  function handleCategoryClick(id: CategoryId) {
    setCategory(id);
    setQ("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg bg-[#141414] border border-neutral-800 p-5 flex flex-col gap-3"
    >
      <div role="group" aria-label="카테고리" className="flex flex-wrap gap-2">
        {CATEGORY_IDS.map((id) => {
          const selected = !isCustom && id === category;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => handleCategoryClick(id)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                selected
                  ? "border-amber-400 text-amber-400"
                  : "border-neutral-800 text-neutral-400 hover:text-neutral-300"
              }`}
            >
              {CATEGORIES[id].label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="직접 키워드 입력 (선택)"
          aria-label="직접 키워드"
          maxLength={MAX_QUERY_LENGTH}
          className="flex-1 rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-amber-400 outline-none"
        />
        <select
          value={days}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (isDays(next)) setDays(next);
          }}
          aria-label="기간"
          className="rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-300 focus:border-amber-400 outline-none"
        >
          {DAYS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              최근 {option}일
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-white text-black px-4 py-2 text-sm font-medium hover:bg-neutral-200 disabled:opacity-50 transition-colors"
        >
          {loading ? "분석 중…" : "분석하기"}
        </button>
      </div>
    </form>
  );
}
