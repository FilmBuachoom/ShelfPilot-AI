# VolumeStrip

A row of numbered volume cells showing owned (solid `ink`), missing (dashed `ink-muted`) and upcoming (`accent-soft` with `accent` border) — the system's signature visual.

- Computed by code from `user_shelf.json` + `catalog.json` (0-token); the LLM never decides which volumes are missing.
- **Baseline editing:** on the series detail, cells are buttons (`sp-vols--lg`, `aria-pressed`); tap toggles owned ↔ missing. This works without AI; natural-language updates are an add-on that ends in the same cells.
- Used in three places: inside chat answers (`sp-vols--sm`), on the shelf screen (full size) and on BookCard.
- After an approval, the newly added cells transition from dashed to solid (200ms) — the "it worked" moment.
- Show the legend once per screen; for > 30 volumes collapse owned runs ("1–24 ✓").
- Shapes differ (solid vs dashed vs outlined), so status reads without color.
