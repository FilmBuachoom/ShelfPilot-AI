---
name: pr-description
description: >
  Generates a pull request title and description from the branch diff, filled into
  the project's PR template. For UI changes it asks whether the user wants screenshots
  and in which style, then embeds them. Use when the
  user asks to write, draft, or fill a PR description, summarize branch changes for
  a PR, or as the first half of creating a PR. Not for commit messages, changelogs,
  or release notes unless explicitly asked.
argument-hint: "[base-branch]"
model: sonnet
allowed-tools: Bash(git branch *), Bash(git log *), Bash(git diff *), Bash(git rev-parse *), Bash(${CLAUDE_SKILL_DIR}/scripts/gather_changes.sh *)
---

# PR description

## Contents

- [Requirements](#requirements)
- [Workflow checklist](#workflow-checklist)
- Steps: [1 Base](#1-confirm-the-base-branch) · [2 Template](#2-choose-the-template) · [3 Gather](#3-gather-the-changes) · [4 Classify](#4-classify) · [5 Screenshots](#5-ask-about-screenshots) · [6 Fill](#6-fill-the-template) · [7 Title](#7-write-the-title) · [8 Verify](#8-verify)
- [Output](#output) · [Edge cases](#edge-cases)

## Requirements

- `git`. Screenshots use the **pr-screenshots** skill (`.Codex/skills/pr-screenshots/SKILL.md`), which lists its own needs.
- `${CLAUDE_SKILL_DIR}` below is this skill's folder (`.Codex/skills/pr-description`).

## Workflow checklist

Copy this into your reply and tick items as you go:

```
- [ ] 1. Base branch confirmed by the user
- [ ] 2. Template chosen
- [ ] 3. Changes gathered
- [ ] 4. Changes classified
- [ ] 5. Screenshots: asked (UI change), and added if wanted
- [ ] 6. Template filled
- [ ] 7. Title written
- [ ] 8. Verification passed
- [ ] 9. Title and body shown in the reply
```

## 1. Confirm the base branch

If `$ARGUMENTS` or the user's request names the base branch, use it. Otherwise **ask, then stop and wait for the answer**. Don't run any later step on an assumed `main` or `develop`. Offer the likely candidates:

```bash
git branch -a --sort=-committerdate | head -20
```

Fall back to `main` (then `develop`) only if the user explicitly leaves the choice to you. If the user pasted a diff or file list, use it and skip step 3 for those parts.

Also note now whether the request already says anything about screenshots (a style, images, or "no screenshots"). Step 5 uses it.

## 2. Choose the template

1. `.github/PULL_REQUEST_TEMPLATE/*.md` exists → pick by the changed paths (Odoo addons → `odoo.md`, Nuxt + Django → `nuxt-django.md`, …). If it is ambiguous, list them and ask.
2. Otherwise `.github/pull_request_template.md`.
3. Otherwise use [templates/default.md](templates/default.md), and suggest adding a template to the repo.

The template is **exact**: keep every heading and checkbox, in order.

## 3. Gather the changes

```bash
${CLAUDE_SKILL_DIR}/scripts/gather_changes.sh <base>
```

The script prints the branch, commits, changed files, stats, and the first 300 diff lines. It falls back to uncommitted changes when no commits are ahead. If the diff is over 500 lines, summarize by file group instead of reading every line.

## 4. Classify

| Category | Signals |
|---|---|
| Feature | New files, routes, views, models |
| Bug fix | `fix/`, `hotfix/` branch; "fix", "resolve", "close #" in commits |
| Refactor | Moves and renames, no behavior change |
| Config / infra | `.github/`, `docker-compose*`, `nginx`, `odoo.conf`, `nuxt.config.ts`, `settings/` |
| DB migration | New files in `migrations/`, `alembic/versions/`, `upgrade_scripts/` |
| Dependencies | `package.json`, `pyproject.toml`, `requirements*.txt`, manifest `depends` |
| Env | `.env.example` changed → deployment needs new variables |

Odoo: also flag manifest version bumps and new `depends`, `security/` access changes, and `data/` changes that affect upgrades.

## 5. Ask about screenshots

UI change = the diff touches `*.vue`, `pages/`, `components/`, `layouts/`, CSS/SCSS, Django `templates/`, Odoo `views/*.xml` or `static/src/`.

Check these in order, and act on the first that matches:

| Situation | Do |
|---|---|
| The request already answers it: a style, images attached, or a no ("no screenshots", "skip screenshots", "no screenshots needed") | Don't ask. Apply that answer from the table below. |
| UI change, not answered yet | Ask the question below, then **stop and wait for the answer**. End your reply with the question. Don't write the title or body yet. |
| No UI change | Don't ask. In the output, add: "No UI files changed, so no screenshots. Say *add screenshots* to add them." |

```
This PR changes the UI. Do you want screenshots of the changes?
1. Default: one screenshot of each changed screen (desktop)
2. Before-After: each screen on <base> and on this branch, side by side
3. Responsive: each screen on Desktop, Tablet, and Smartphone
4. No screenshots
You can also paste or attach your own images.
```

| Answer | Do |
|---|---|
| 1, 2, or 3 | Follow **pr-screenshots** (`.Codex/skills/pr-screenshots/SKILL.md`) with that style. Its markdown goes in the Screenshots section. |
| Images pasted or attached | pr-screenshots steps 4–5 (upload, embed), Default layout unless the user labels them before/after |
| 4 or no | Screenshots section: `N/A`. Don't ask again. |

pr-screenshots isn't installed → ask the user to drag the images into the PR editor on GitHub. Never commit images.

## 6. Fill the template

| Section | Write |
|---|---|
| Summary | 2–4 sentences: what changed, why, the approach |
| Type / Changes | Tick matching boxes; bullets grouped by area, not one per file |
| Testing | Numbered steps a reviewer can follow without asking: setup, data, URLs |
| Screenshots | The markdown from step 5, or `N/A` with the reason |
| Related issues | From branch or commits: `#42` → `Closes #42`; `UC-123` → plain reference |
| Caution / Breaking / Deployment | Migrations, env vars, restarts, API contract changes — tick and explain |
| Checklist | Tick only what the diff proves; leave the rest unticked |

Be specific ("Add `stock.move` domain filter to WMS picking view", not "Update views"), and flag risks explicitly.

## 7. Write the title

Use Conventional Commits, imperative mood, ≤ 72 characters, no trailing period. The type comes from step 4 and the branch prefix. Put a ticket ID right after the type.

| Branch + main change | Title |
|---|---|
| `feature/UC-123-invoice-export`, new export endpoint | `feat: UC-123 add invoice CSV export` |
| `fix/login-redirect`, redirect bug | `fix: redirect to dashboard after login` |
| `chore/upgrade-nuxt-4`, dependency bump | `chore: upgrade Nuxt to 4.1` |

If the change deserves a bigger version step than its commits suggest (see AGENTS.md, Git and PRs), *suggest* `[minor]` / `[major]` to the user. Don't add it on your own.

## 8. Verify

Check each item. On a failure, go back to the step shown, fix it, and run the whole list again until every item passes:

- [ ] Every template heading is filled, or has a one-line reason it's empty → else step 6
- [ ] Ticked boxes match the actual diff (not all ticked, not all empty) → else step 4
- [ ] Migrations, env changes, and API contract changes from the file list are called out → else step 3
- [ ] Testing steps are runnable as written → else step 6
- [ ] UI change → the user was asked, and the answer is applied (embedded `https://` images, or `N/A`) → else step 5
- [ ] No image files committed (`git diff <base>...HEAD --name-only` shows no screenshots or `.github/pr-assets/`) → remove them from the branch
- [ ] Title follows step 7 → else step 7
- [ ] Headings are the chosen template's, word for word → else step 2

## Output

Put the result **in your reply**. Don't only save it to a file: the user copies it from the chat. (pr-create also writes the body to a file; that's in addition to the reply.)

1. The title in its own ```` ```text ```` block.
2. The full body in one ```` ```markdown ```` block, ready to paste.
3. One line per section left empty, and why.

## Edge cases

| Situation | Do |
|---|---|
| No commits ahead and no local changes | Say "Nothing to describe." and stop |
| Binary files changed | Name them; skip their content |
| User pasted the diff | Use it; skip the git commands |
| Screenshot upload fails | Never commit the image; use the fallback in pr-screenshots step 4 |
