# BookCard

Shopee-style product card for one book or volume: 2:3 cover, one status tag on the cover, title, edition · publisher, a countdown or mini VolumeStrip, and a one-line ✦ reason from the recommender.

- Width `book-card-width` (168px) in a horizontally scrolling `sp-row` under a section head with "ดูทั้งหมด ›".
- One tag on the cover at most (ใหม่ / ขาด N เล่ม / ✓ ประกาศแล้ว).
- The ✦ line is the LLM's reason, max one line; the full reason and citations open in the detail view.
- The card's own button is secondary; the orange action ("ไปหน้าร้าน") lives only in ConfirmModal.
- Consumer provides cover image (falls back to the volume-number glyph on a token-colored block).
