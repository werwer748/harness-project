import type {
  CategoryConfig,
  CategoryId,
  Days,
  ReportScope,
  TemplateSet,
} from "@/types";

// 템플릿에는 받침에 따라 바뀌는 조사(은/는, 이/가, 을/를)를 {keyword} 바로 뒤에 두지 않는다.
export const CATEGORIES: Record<CategoryId, CategoryConfig> = {
  "life-tips": {
    id: "life-tips",
    label: "생활 꿀팁",
    description: "살림·자취·정리처럼 바로 따라 할 수 있는 일상 정보",
    seedKeywords: ["생활꿀팁", "살림 꿀팁", "자취 꿀팁"],
    titleTemplates: [
      { key: "must-know", text: "{keyword} 모르면 손해 보는 3가지" },
      { key: "common-mistake", text: "{keyword}, 다들 이렇게 잘못하고 있어요" },
      { key: "one-minute", text: "1분 만에 끝내는 {keyword} 꿀팁" },
      { key: "save-money", text: "돈 아끼는 {keyword} 방법" },
      { key: "pro-secret", text: "살림 고수만 아는 {keyword} 비법" },
      { key: "before-after", text: "{keyword} 전후 비교, 이렇게 달라져요" },
    ],
    hookTemplates: [
      "{keyword}, 아직도 이렇게 하세요?",
      "이거 하나면 {keyword} 고민 끝입니다.",
      "{keyword} 할 때 딱 이것만 바꿔 보세요.",
      "{keyword} 꿀팁, 저장해 두고 따라 해 보세요.",
    ],
  },
  quotes: {
    id: "quotes",
    label: "명언",
    description: "짧은 한 문장으로 마음을 움직이는 명언·동기부여",
    seedKeywords: ["명언", "인생 명언", "동기부여 명언"],
    titleTemplates: [
      { key: "one-line", text: "{keyword}에 대해 한 줄로 말하면" },
      { key: "wish-knew", text: "20대에 알았다면 좋았을 {keyword} 명언" },
      { key: "hard-day", text: "힘들 때 꺼내 보는 {keyword} 한마디" },
      { key: "great-minds", text: "위인들이 남긴 {keyword} 명언 3가지" },
      { key: "life-changing", text: "인생을 바꾼 {keyword} 한 문장" },
      { key: "before-sleep", text: "잠들기 전 듣는 {keyword} 명언" },
    ],
    hookTemplates: [
      "{keyword}, 이 한 문장이면 충분합니다.",
      "오늘 {keyword} 때문에 지쳤다면 이 말을 들어 보세요.",
      "{keyword}에 대해 이보다 정확한 말은 없습니다.",
      "10초만 멈추고 {keyword}에 대한 이 문장을 들어 보세요.",
    ],
  },
  "self-reflection": {
    id: "self-reflection",
    label: "자기객관화",
    description: "나를 한 걸음 떨어져 보게 하는 자기성찰·메타인지",
    seedKeywords: ["자기객관화", "자기성찰", "메타인지"],
    titleTemplates: [
      { key: "not-only-me", text: "{keyword}, 나만 그런 게 아니었다" },
      { key: "self-check", text: "{keyword} 자가진단 체크리스트" },
      { key: "signs", text: "{keyword} 신호 3가지, 몇 개나 해당되나요?" },
      { key: "be-honest", text: "{keyword} 앞에서 솔직해지는 법" },
      { key: "others-view", text: "남들 눈에 비친 {keyword}의 진짜 모습" },
      { key: "real-reason", text: "우리가 {keyword}에 약한 진짜 이유" },
    ],
    hookTemplates: [
      "혹시 {keyword}, 나만 그런가 싶었나요?",
      "{keyword} 때문에 괴로웠다면 끝까지 보세요.",
      "{keyword}, 인정하는 순간 달라집니다.",
      "지금부터 {keyword} 신호 세 가지를 말씀드릴게요.",
    ],
  },
};

export const CATEGORY_IDS: CategoryId[] = [
  "life-tips",
  "quotes",
  "self-reflection",
];

export const CUSTOM_TEMPLATES: TemplateSet = {
  titleTemplates: [
    { key: "summary", text: "{keyword}, 1분 만에 정리해 드립니다" },
    { key: "hidden-truth", text: "아무도 말해 주지 않은 {keyword}의 진실" },
    { key: "top-3", text: "{keyword} 핵심 3가지" },
    { key: "beginner-guide", text: "처음 시작하는 사람을 위한 {keyword} 가이드" },
    { key: "common-mistake", text: "{keyword} 할 때 흔히 하는 실수" },
    { key: "trend-reason", text: "요즘 다들 {keyword} 찾는 진짜 이유" },
  ],
  hookTemplates: [
    "{keyword}, 이것만 알면 됩니다.",
    "{keyword} 때문에 고민이라면 딱 30초만 보세요.",
    "요즘 {keyword} 얘기가 많은데, 핵심만 짚어 드릴게요.",
    "{keyword}, 대부분 이 부분을 놓칩니다.",
  ],
};

export const DAYS_OPTIONS: Days[] = [7, 30, 90];

export function isCategoryId(value: unknown): value is CategoryId {
  return (CATEGORY_IDS as readonly unknown[]).includes(value);
}

export function isDays(value: unknown): value is Days {
  return (DAYS_OPTIONS as readonly unknown[]).includes(value);
}

export function getTemplateSet(scope: ReportScope): TemplateSet {
  return scope === "custom" ? CUSTOM_TEMPLATES : CATEGORIES[scope];
}
