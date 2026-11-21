// Generated from schemas/ by npm run gen:types. Do not edit.

export interface ChatAnswer {
  text: string;
  book_ids: string[];
  source_ids: string[];
  not_found: boolean;
  needs_clarification: boolean;
}
