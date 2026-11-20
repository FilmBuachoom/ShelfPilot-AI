# CitationChip

Small grey pill (`surface-subtle`, `radius-pill`) at the end of a sentence that names its source — publisher + date — and opens the evidence card (`sp-source`).

- Built from `source_id` only: the frontend hydrates name, date, raw_text and URL; the LLM never prints a URL.
- The `verified-ink` dot means the claim is backed by a stored source.
- The evidence card shows `raw_text` in `text-mono` and one secondary button to open the original post.
