# ApprovalSheet

Bottom sheet (Shopee checkout style) that shows what `propose_shelf_update` matched — title, edition, and a mono diff "+ 9–12" — and writes to `user_shelf.json` only after the user taps the action button.

- Title states the count as a question: "เพิ่มลงคลัง 5 เล่ม?"; subtitle quotes the user's own words.
- One row per series; the diff uses `text-mono` in `verified-ink`.
- Ambiguous matches never appear here — the chat asks back first (or rows get a `review` badge and the action is disabled until resolved).
- Actions: "แก้ไข" (default) + "ยืนยัน N เล่ม" (action, fills the rest of the row).
- On confirm: close the sheet, then animate the VolumeStrip cells to solid.
