# Announcement ingestion (#10)

`POST /api/ingest` accepts `{ raw_text, source_url, publisher_hint? }`. The server
extracts with the schema in `schemas/extraction.schema.json`, normalizes volumes
and dates, and returns `{ status, message, source, extraction }`. `/admin` hosts a
self-contained `ImportExtractForm`; #13 can import that component into its shell.
The component's scoped Button/Badge CSS and token values copy the design snapshot;
its form and table styles cover elements absent from the bundle. It does not
change the global app shell or design snapshot. #13 supplies the shared fonts.

## Persistence and integration

Without all three `PipelineStages` (`match`, `disambiguate`, `write`), the pipeline
returns `dry_run` and writes nothing. #11/#12 inject these stages into
`runPipeline(input, { stages })` and own atomic catalog/review persistence. The
source audit record is returned intact so the eventual write can store it with
its decisions. A source already persisted in `catalog.sources` returns
`already_imported` before any LLM call. A repeated **dry-run** is not a persisted
import and therefore extracts again. There is no process-memory import ledger.

The URL is provenance only; the server does not fetch it. Missing publishers are
represented as an empty string in the source audit record and as null in extracted
items. Unknown editions or unsupported edition evidence remain null for review.
Fractional volumes such as 7.5 are preserved. A month-only release has
`release_date: null` and `release_date_precision: "month"`; its exact wording stays
in `source.raw_text`. The catalog's full-day date contract is unchanged. #11/#12
must review incomplete items before turning them into catalog records.

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

From `web/`, run `npm ci`, `npm run gen:types`, `npm test`, `npm run lint`,
`npm run typecheck`, and `npm run build`. Unit tests use synthetic mocked outputs
and make no paid LLM calls. For a manual real-model check, configure OpenAI as in
`web/README.md`, run `npm run dev`, and open `/admin` with an authorized publisher
announcement. Confirm multiple extracted rows, edition unknown when unstated,
and the dry-run notice; verify `git diff -- data` is empty. A real-model check
requires a key and authorized source text; automated tests do not claim it ran.

The current MVP has no authentication layer; `/admin` is a local development
screen. Review access controls and storage with the team before deploying paid
import functionality publicly. No database selection or catalog writes are added.
