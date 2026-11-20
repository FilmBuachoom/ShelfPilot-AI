# ReviewQueueItem

Admin card for one announcement the pipeline would not merge on its own (`needs_review`, confidence < 0.8): raw text and score on the left, candidate editions on the right.

- The whole card has a dashed `review-line` border and a `review-soft` header naming why it is here.
- Left: `raw_text` in `text-mono`, source and date, a confidence bar (`review-line` below 0.8, `verified-ink` at or above).
- Right: radio options, each with the candidate `book_id` and an edition badge.
- Footer: ข้าม (ghost) · สร้างรายการใหม่ (`distinct_edition`) · ตรวจและรวม (action).
- Admin screens are denser and monochrome (OpenAI platform feel); keep orange to the one action.
