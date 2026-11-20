# ShelfHeader

Top of the home screen ("คลังของฉัน"): title, a quiet "+ เพิ่มเรื่อง" button, four stat tiles (เรื่อง · เล่ม · ขาด · ใกล้ออก) and a pill search field.

- Stats are computed by code from `user_shelf.json` + `catalog.json` (0-token). Tapping "ขาด" or "ใกล้ออก" selects the matching FilterTab.
- Only "ใกล้ออก" uses color (`accent-ink`); the rest stay `ink`.
- Search is local fuzzy search (Fuse.js) across Thai, English and Japanese titles — no LLM.
- "+ เพิ่มเรื่อง" is a manual form (baseline). Natural-language adding lives in the AI add-on.
