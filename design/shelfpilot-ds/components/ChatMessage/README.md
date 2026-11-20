# ChatMessage

User turns are a grey bubble on the right (`surface-subtle`, `radius-lg`); AI turns have no bubble — plain full-width text beside a small ✦ mark, as in ChatGPT.

- Answer first, reason second. Any catalog fact carries a CitationChip at the end of its sentence.
- Data is rendered as components inside the AI turn (VolumeStrip, BookCard row, ApprovalSheet trigger), never as raw URLs or JSON.
- When the catalog has nothing: say "ยังไม่พบในแค็ตตาล็อก" and offer a next step; never guess.
