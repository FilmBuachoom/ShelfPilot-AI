// Generated from schemas/ by npm run gen:types. Do not edit.

export type Edition = "manga" | "light_novel" | "special_set" | "big_book";
export type BookId = string;
export type Volumes = number[];

export interface ChatAnswer {
  text: string;
  book_ids: string[];
  source_ids: string[];
  not_found: boolean;
  needs_clarification: boolean;
  proposal?: ShelfProposal;
}
export interface ShelfProposal {
  user_text: string;
  total: number;
  items: ShelfProposalItem[];
}
export interface ShelfProposalItem {
  series_id: string;
  edition: Edition;
  add: BookId[];
  remove: BookId[];
  already_owned: Volumes;
  not_owned: Volumes;
  not_found_volumes: Volumes;
}
