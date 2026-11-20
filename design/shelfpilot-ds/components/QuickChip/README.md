# QuickChip

Pill shortcut above the composer; chips marked ⚡ (`sp-chip__bolt`, `accent-ink`) run a 0-token query against local JSON and render instantly.

- ⚡ chips never show a typing indicator — the result appears in the same frame.
- A chip without ⚡ sends its text as a normal LLM prompt (e.g. "จัดงบ 500 บาท").
- 3–5 chips, horizontally scrollable on mobile (`sp-chips`). Label ≤ 16 Thai characters.
