export type CategoryId = "life-tips" | "quotes" | "self-reflection";
export type ReportScope = CategoryId | "custom"; // custom = 사용자가 직접 입력한 키워드
export type Days = 7 | 30 | 90;

export interface TitleTemplate {
  key: string;
  text: string; // '{keyword}' 포함
}

export interface TemplateSet {
  titleTemplates: TitleTemplate[]; // 6개 이상, key는 세트 안에서 고유
  hookTemplates: string[]; // 4개 이상, 각각 '{keyword}' 포함
}

export interface CategoryConfig extends TemplateSet {
  id: CategoryId;
  label: string; // 화면 표시명
  description: string; // 한 줄 설명
  seedKeywords: string[]; // 정확히 3개 (YouTube 검색어)
}
