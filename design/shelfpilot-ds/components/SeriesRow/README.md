# SeriesRow

One series in the inventory list — cover thumb, title, edition badge, owned/total count with the missing numbers in words, and a small VolumeStrip — the core unit of the baseline app.

- Manga and novel of the same title are **separate rows** (one edition per row); never merge them.
- Count reads "11/14 · ขาด 9, 10" or "13/13 · ครบแล้ว"; the strip shows the same thing visually.
- One status badge at most next to the title (ใหม่ when a new volume is announced).
- Tap opens the series detail: large interactive VolumeStrip (`sp-vols--lg`), publisher sources and the store button (via ConfirmModal).
- Consumer provides cover image; fallback is the first letter on a token-colored block.
- Sort default: series with missing or upcoming volumes first, then recently updated.
