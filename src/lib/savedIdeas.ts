import type { ContentIdea, SavedIdea } from "@/types";

// 저장한 아이디어 스냅샷을 localStorage에 둔다 (ADR-003).
// window·localStorage는 함수 안에서만 접근해 서버 렌더링에서도 import할 수 있다.

export const SAVED_IDEAS_KEY = "shorts-idea-lab:saved-ideas:v1";
export const MAX_SAVED_IDEAS = 100;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  // 사파리 프라이빗 모드 등에서는 localStorage 접근 자체가 던진다
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSavedIdeas(storage?: StorageLike | null): SavedIdea[] {
  const target = resolveStorage(storage);
  if (!target) return [];

  let parsed: unknown;
  try {
    const raw = target.getItem(SAVED_IDEAS_KEY);
    if (raw === null) return [];
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  // 손상된 항목은 버리고, 같은 id는 앞(최신)의 것만 남긴다
  const ideas: SavedIdea[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    if (!isSavedIdea(item) || seen.has(item.id)) continue;
    seen.add(item.id);
    ideas.push(item);
  }
  return ideas;
}

export function saveIdea(
  idea: ContentIdea,
  now: Date,
  storage?: StorageLike | null,
): SavedIdea[] {
  const target = resolveStorage(storage);
  const current = loadSavedIdeas(target);
  // id는 step 4가 만든 결정적 값이라 그대로 중복 제거 키로 쓴다
  if (isIdeaSaved(current, idea.id)) return current;

  const next = [{ ...idea, savedAt: now.toISOString() }, ...current].slice(
    0,
    MAX_SAVED_IDEAS,
  );
  persist(target, next);
  return next;
}

export function removeIdea(id: string, storage?: StorageLike | null): SavedIdea[] {
  const target = resolveStorage(storage);
  const current = loadSavedIdeas(target);
  if (!isIdeaSaved(current, id)) return current;

  const next = current.filter((idea) => idea.id !== id);
  persist(target, next);
  return next;
}

export function isIdeaSaved(ideas: SavedIdea[], id: string): boolean {
  return ideas.some((idea) => idea.id === id);
}

// 생략(undefined)이면 브라우저 저장소, null이면 저장하지 않는다
function resolveStorage(storage: StorageLike | null | undefined): StorageLike | null {
  return storage === undefined ? getBrowserStorage() : storage;
}

// 용량 초과 등으로 쓰기에 실패해도 화면은 계산된 목록으로 계속 동작한다
function persist(storage: StorageLike | null, ideas: SavedIdea[]): void {
  if (!storage) return;
  try {
    storage.setItem(SAVED_IDEAS_KEY, JSON.stringify(ideas));
  } catch {
    // 삼킨다
  }
}

function isSavedIdea(value: unknown): value is SavedIdea {
  if (typeof value !== "object" || value === null) return false;
  const { id, keyword, titles, savedAt } = value as Record<string, unknown>;
  return (
    typeof id === "string" &&
    typeof keyword === "string" &&
    Array.isArray(titles) &&
    titles.every((title) => typeof title === "string") &&
    typeof savedAt === "string"
  );
}
