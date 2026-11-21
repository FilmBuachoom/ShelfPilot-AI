import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { ReviewQueueItem } from "@/components/ReviewQueueItem/ReviewQueueItem";
import type { ReviewQueue } from "@/types/generated";

vi.mock("@/components/CitationChip/CitationChip", () => ({ CitationEvidence: () => null }));

const item: ReviewQueue["items"][number] = {
  review_id: "review-test",
  source_id: "source-test",
  extracted: {},
  candidates: [{ book_id: "book-test", edition: "manga", confidence: 0.7 }],
  reason: "ต้องตรวจสอบ",
  status: "open",
  created_at: "2026-01-01T00:00:00Z",
};

test("highlights the merge action only for the selected review", () => {
  const unselected = renderToStaticMarkup(<ReviewQueueItem item={item} onSelect={() => {}} />);
  const selected = renderToStaticMarkup(<ReviewQueueItem item={item} selected="book-test"
    onSelect={() => {}} onMerge={() => {}} />);

  expect(unselected).not.toContain("sp-btn--action");
  expect(selected).toMatch(/class="sp-btn sp-btn--action sp-btn--sm"[^>]*>ตรวจและรวม/);
});
