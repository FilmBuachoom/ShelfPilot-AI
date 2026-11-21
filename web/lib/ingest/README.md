# Announcement ingestion (#10 and #11)

`POST /api/ingest` accepts `{ raw_text, source_url, publisher_hint? }`. The server
extracts and normalizes the announcement, checks a Fuse.js shortlist of up to
five books per item with Structured Outputs, and decides the catalog action in
code. Candidates include catalog aliases and favor the extracted volume. An
empty shortlist skips the match model.

On `/admin`, the import form displays each item's `match_status`, candidate ID,
matched alias, and reason. Duplicate announcements add provenance to the same
book, retain the most precise date, and can advance the sale status. Distinct
editions get stable IDs. A single atomic write records any accepted books and
their source. A source already stored in `catalog.sources` skips extraction
when submitted again. This includes exact replays of seeded evidence with an
existing `demo-*` source ID. Edited text at the same URL gets a new source ID.
The edition check requires a source quote that supports the extracted edition
and confidence of at least 0.8 from extraction and from matching when a
match call ran. It checks the volume on the source rows even if the extractor
returns only one item. A base-format quote inside a special edition label
does not establish the base edition. Accepted items are written to the catalog;
review-only imports leave it untouched.

In local JSON mode, the pipeline writes `needs_review` results to
`review_queue.json`. They show the announcement alongside catalog editions
of the same volume in the matched series or sharing a title or alias. New
queue entries keep their source in the schema's open-ended `extracted` object.
In Admin, select a book to merge its provenance, select an edition to create
a distinct book, or skip. To create when multiple publication lines match,
select a reference book in the intended line, including an earlier volume
when needed. If an identical edition appears during a retry, the recorded
approval can finish within its selected line. A conflict across lines
reopens the choice with updated candidates. Each resolution closes the review.
Existing queue entries without an embedded announcement can still be shown and skipped.

The URL is provenance supplied by the admin. Ingestion keeps fractional volumes
and preserves a month-only window as written in `source.raw_text`. A book's
optional `release_date` stays absent if no day is known. New books require a
title, volume, stated edition, and publisher. The audit source uses the extracted
publisher when available, then the optional user-supplied hint.

Import runs through the loopback-bound development server (`npm run dev`) with a
writable data directory. The Admin page and API limit ingestion to local
development with the JSON backend; the API also checks the browser origin
before processing a POST. The Supabase demo backend leaves import disabled.

## Relationship to PR #16

Reviewed PR #16 at `5aeca0732c6c9884e15cdbab2277909970adc22c`. It adds curated
fixtures and documentation, without changing application schemas or runtime.
All 23 indexed section IDs and entry counts match the seven HTML files.

The index's `demo-*` IDs identify fixture sections; ingestion always generates
its own `src_*` from normalized text and URL. Keep the fixture ID in replay/test
metadata rather than overriding the canonical source ID. Supply the original
URL as `source_url`, omit `.lookup-aliases` from publisher evidence, and include
the section heading so month/year context survives extraction. ISBN enrichment,
HTML parsing and live fetching are outside #10. The fixtures themselves state
that public visibility does not establish authorization for catalog import.
No PR #16 fixtures are copied into the runtime catalog by this change.

## Verification

From `web/`, run `npm test -- tests/ingest`. These tests exercise the API and
atomic apply logic with synthetic inputs, mocked model responses, and a
temporary catalog.

For the opt-in real-model test, set `OPENAI_API_KEY` and point
`SHELFPILOT_MATCH_FIXTURE` to a JSON file containing:

- `catalog` with the existing book and its lookup aliases
- `book_id` for that book
- `queries` with three title variants, such as Thai, romaji, and a short name
- `announcements` with two authorized `{ raw_text, source_url, publisher_hint? }`
  inputs for the same book on different channels, pre-order first and release
  second

Run `npm test -- tests/ingest/match.llm.test.ts`. The test writes to a temporary
catalog. For a manual UI replay, run `npm run dev` with `SHELFPILOT_DATA_DIR`
pointing to a copy of the catalog files, then submit the same posts on
`/admin`. Confirm that the second post shows the original book ID and
`duplicate_merged`, with one new source and no new book. Public demo fixtures
described in [demo-data-sources.md](../../../docs/demo-data-sources.md) require
publisher authorization before replaying them into ingestion.
