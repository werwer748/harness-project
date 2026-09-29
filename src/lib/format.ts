// 화면 표시용 숫자·날짜 포맷. 순수 함수이고, 표시할 수 없는 값은 '-'로 쓴다.

const EMPTY = "-";

const countFormatter = new Intl.NumberFormat("ko-KR", { notation: "compact" });

// 1234 → '1.2천', 15300 → '1.5만'
export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return EMPTY;
  return countFormatter.format(n);
}

// 추천 근거 문장(recommend.ts)과 같은 소수 첫째 자리 표기
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return EMPTY;
  return `${(ratio * 100).toFixed(1)}%`;
}

// 45 → '45초', 125 → '2분 5초', 180 → '3분'
export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return EMPTY;
  // 반올림을 먼저 해야 59.6초가 '60초'가 아니라 '1분'이 된다
  const total = Math.round(sec);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds}초`;
  return seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`;
}

export function formatMultiplier(x: number): string {
  if (!Number.isFinite(x)) return EMPTY;
  return `×${x.toFixed(1)}`;
}

// 실행 환경의 시간대와 관계없이 UTC 날짜로 쓴다
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return EMPTY;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}
