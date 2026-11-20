# Button

Pill button; `sp-btn--action` (orange) is allowed once per view, for the step the screen exists for.

- **Action** `sp-btn sp-btn--action`: ยืนยัน, ไปหน้าร้าน. Fill `action`, text `on-action`.
- **Default** `sp-btn`: secondary choices (แก้ไขรายการ, ดูแหล่งที่มา).
- **Ghost** `sp-btn--ghost`: cancel / dismiss.
- **Block** `sp-btn--block`: full-width 48px, used at the bottom of ApprovalSheet and ConfirmModal.
- **Small** `sp-btn--sm`: inside cards and table rows.

Label = verb + count when there is one: "ยืนยัน 5 เล่ม", not "ตกลง". Consumer provides the label and handler.
