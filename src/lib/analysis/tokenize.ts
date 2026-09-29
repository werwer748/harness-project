// 형태소 분석기 없이 쇼츠 제목·태그에서 키워드 후보를 뽑는다 (ADR-002).
// 영상 설명(description)은 링크·반복 해시태그 노이즈가 커서 다루지 않는다.

// '방법'처럼 제목 패턴 분석에서 따로 다루는 단어도 키워드로는 제외한다.
export const STOPWORDS: ReadonlySet<string> = new Set([
  "shorts",
  "short",
  "쇼츠",
  "숏츠",
  "유튜브",
  "영상",
  "구독",
  "좋아요",
  "댓글",
  "알림",
  "오늘",
  "진짜",
  "정말",
  "그냥",
  "이것",
  "그것",
  "하는",
  "있는",
  "없는",
  "모든",
  "가지",
  "방법",
]);

// '이라는'이 '라는'보다 먼저 검사되도록 긴 조사부터 둔다.
const MULTI_SYLLABLE_PARTICLES = [
  "이라는",
  "에서",
  "으로",
  "처럼",
  "까지",
  "부터",
  "에게",
  "한테",
  "보다",
  "라는",
  "이란",
];

// '효과', '고양이', '정도'처럼 명사의 끝 글자와 겹치므로 어간이 vocabulary에 있을 때만 뗀다.
const SINGLE_SYLLABLE_PARTICLES: ReadonlySet<string> = new Set([
  "은",
  "는",
  "이",
  "가",
  "을",
  "를",
  "의",
  "도",
  "만",
  "와",
  "과",
  "로",
  "에",
]);

const MIN_STEM_LENGTH = 2;

// 완성형 한글 음절, 영문 소문자, 숫자 외에는 모두 구분자로 본다.
const NON_WORD = /[^0-9a-z가-힣]+/g;
const PURE_NUMBER = /^\d+$/;

function isCandidate(token: string): boolean {
  return (
    token.length >= MIN_STEM_LENGTH &&
    !PURE_NUMBER.test(token) &&
    !STOPWORDS.has(token)
  );
}

export function normalizeText(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(NON_WORD, " ").trim();
}

export function tokenize(text: string): string[] {
  return normalizeText(text).split(" ").filter(isCandidate);
}

export function buildVocabulary(texts: string[]): Set<string> {
  return new Set(texts.flatMap(tokenize));
}

export function stripParticle(
  token: string,
  vocabulary: ReadonlySet<string>,
): string {
  for (const particle of MULTI_SYLLABLE_PARTICLES) {
    const stemLength = token.length - particle.length;
    if (token.endsWith(particle) && stemLength >= MIN_STEM_LENGTH) {
      return token.slice(0, stemLength);
    }
  }

  const stem = token.slice(0, -1);
  if (
    SINGLE_SYLLABLE_PARTICLES.has(token.slice(-1)) &&
    stem.length >= MIN_STEM_LENGTH &&
    vocabulary.has(stem)
  ) {
    return stem;
  }

  return token;
}

export function toExcludedTerms(queries: string[]): Set<string> {
  const excluded = new Set<string>();
  for (const query of queries) {
    for (const token of tokenize(query)) excluded.add(token);
    const joined = normalizeText(query).replace(/ /g, "");
    if (joined) excluded.add(joined);
  }
  return excluded;
}

export function extractVideoTerms(
  video: { title: string; tags: string[] },
  vocabulary: ReadonlySet<string>,
  excluded: ReadonlySet<string>,
): string[] {
  const terms = new Set<string>();
  for (const text of [video.title, ...video.tags]) {
    for (const token of tokenize(text)) {
      const term = stripParticle(token, vocabulary);
      // 조사를 떼고 나면 '방법', '2026'처럼 다시 걸러야 할 어간이 나올 수 있다.
      if (!excluded.has(term) && isCandidate(term)) terms.add(term);
    }
  }
  return [...terms];
}
