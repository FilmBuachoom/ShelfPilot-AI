# AGENTS.md

Instructions for Codex and other agents that read `AGENTS.md`. The source of truth is
`CLAUDE.md` plus `.claude/rules/*.md` — read them before working; this file only
summarizes what must never be missed.

## Read first

| When you touch | Read |
|---|---|
| anything | `CLAUDE.md` (product, 3 LLM hubs, Core Rules, Ask first, Never) |
| `ingest/**` | `.claude/rules/ingest.md`, `.claude/rules/llm.md`, `.claude/rules/data-contract.md` |
| `web/**` | `.claude/rules/web.md` (+ `llm.md` for `api/`, `server/`, `lib/`) |
| `schemas/**`, `data/**` | `.claude/rules/data-contract.md` |

Full team brief: `docs/brief.md`.

## Never

- Put an OpenAI key in code, in `NEXT_PUBLIC_*`, or call OpenAI from the browser (`dangerouslyAllowBrowser`).
- Edit `.env` files (edit `.env.example`), commit secrets, or bypass git hooks (`--no-verify`).
- Invent book or announcement data in the catalog.
- Let the LLM decide the 0.8 threshold, count missing volumes, or write `user_shelf.json` without the Approval Gate.
- Send whole JSON files to the LLM; cite only `book_id` / `source_id`, never URLs.

## Ask first

Adding dependencies; changing `edition` / `match_status` enums or the 0.8 threshold; hand-editing
`schemas/` or `data/*.json`; choosing the database; adding an LLM call outside the 3 hubs.

Claude Code enforces some of these with hooks in `.claude/`; Codex does not run them, so
follow them yourself. `pre-commit` (gitleaks, no `.env`) runs for everyone on commit.
