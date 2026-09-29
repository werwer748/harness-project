// YouTube contentDetails.duration 형식: P[nW][nD][T[nH][nM][nS]]
const ISO_DURATION =
  /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

const UNIT_SECONDS = [7 * 86400, 86400, 3600, 60, 1];

export function parseIsoDuration(iso: string): number {
  const match = ISO_DURATION.exec(iso);
  if (!match) return 0;

  return UNIT_SECONDS.reduce(
    (total, unit, index) => total + Number(match[index + 1] ?? 0) * unit,
    0,
  );
}
