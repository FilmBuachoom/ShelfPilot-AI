---
name: issue-create
description: >
  Creates one or many GitHub issues with the gh CLI, sets the issue's Priority field,
  and links them to a GitHub Project (Projects v2) with a Status. Handles bulk input (lists,
  meeting notes, feature breakdowns) in a Short version (created right away) or a
  Detailed version (each item discussed first), uses the repo's issue templates or
  built-in Bug / Feature / Task ones, and always previews before creating. Use when
  the user asks to create, open, file, log, or raise an issue, bug, or ticket, add
  something to the backlog or project board, or turn notes or a list into issues.
argument-hint: "[what to file]"
model: sonnet
allowed-tools: Bash(gh auth status), Bash(gh repo view *), Bash(gh label list *), Bash(gh issue list *), Bash(gh project list *), Bash(gh project view *), Bash(gh project field-list *)
---

# Create issue

Create GitHub issues from a request (single or bulk) in a **Short** or **Detailed** version, set **Priority** as a field on the issue (never as body text), and link them to a GitHub Project with a **Status**, using the `gh` CLI.

## Contents

- [Requirements](#requirements) · [Configuration](#configuration) · [Workflow checklist](#workflow-checklist)
- Steps: [1 Context](#1-detect-context) · [2 Short or Detailed](#2-short-or-detailed) · [3 Classify](#3-classify) · [4 Title and body](#4-title-and-body) · [5 Priority and Status](#5-priority-and-status) · [6 Duplicates](#6-duplicate-check) · [7 Preview](#7-preview-and-confirm) · [8 Create and set Priority](#8-create-and-set-priority) · [9 Link](#9-link-to-the-project) · [10 Report](#10-report)
- [Bulk rules](#bulk-rules) · [Edge cases](#edge-cases)

## Requirements

- `gh`, authenticated (`gh auth status`). Install: `brew install gh` / `sudo apt install gh` / `winget install GitHub.cli`, then `gh auth login`.
- Linking to a project needs the `project` token scope. If `gh auth status` doesn't list it (or a `gh project` command fails with a scope error), stop and ask the user to run `gh auth refresh -s project`. Issues can still be created without it; offer that, and report the project link as skipped.

## Configuration

The default project and field values live in `.github/issue-config.yml` of the target repo (installed from workflow-instructions):

```yaml
project:
  owner: ai-deta          # org or user that owns the project
  number: 3               # from the project URL: github.com/orgs/ai-deta/projects/3
defaults:
  status: Backlog         # Backlog | Todo
  priority: Medium        # Urgent | High | Medium | Low
```

| Situation | Do |
|---|---|
| Config exists | Use it; still show the project in the preview so the user can change it |
| No config | `gh project list --owner <repo-owner>`, and ask the user to pick one or "no project". Then offer once to create `.github/issue-config.yml`; don't create it without approval. |
| User names a project in the request | The request wins over the config |

## Workflow checklist

Copy this into your reply and tick items as you go:

```
- [ ] 1. Context detected
- [ ] 2. Short / Detailed chosen (Detailed: every item agreed)
- [ ] 3. Each item classified
- [ ] 4. Titles and bodies written
- [ ] 5. Priority and Status set
- [ ] 6. Duplicates checked
- [ ] 7. Preview confirmed by the user
- [ ] 8. Issues created, Priority field set
- [ ] 9. Linked to the project
- [ ] 10. Result reported
```

### 1. Detect context

```bash
gh repo view --json nameWithOwner,owner -q '.nameWithOwner'          # or the repo the user named
gh label list --limit 200 --json name -q '.[].name'
gh api repos/{owner}/{repo}/milestones -q '.[].title'
ls .github/ISSUE_TEMPLATE/ 2>/dev/null || gh api repos/{owner}/{repo}/contents/.github/ISSUE_TEMPLATE -q '.[].name'
cat .github/issue-config.yml 2>/dev/null
```

Also look up the Priority issue field once (step 1 of [reference/priority-field.md](reference/priority-field.md)), so the preview can say where Priority will be set.

If the working directory isn't the target repo, read templates and config with `gh api repos/{owner}/{repo}/contents/<path>`.

### 2. Short or Detailed

Unless the user already said ("short", "quick" / "detailed", "discuss"), ask **once** for the whole request:

> I found **2 items**. Create them as:
> - **Short**: title + one-line summary, created right away
> - **Detailed**: we go through each item together first, then I create them
>
> You can also mix, e.g. `short, but detailed for 2`.

| | Short | Detailed |
|---|---|---|
| Best for | Capturing backlog quickly | Items about to be planned, estimated, or built |
| Questions | None | 2–4 per item, one item at a time |
| Body | [templates/short.md](templates/short.md): only the user's own words and sub-items | The full template for its type (step 4) |

**Short:** use only what the user wrote. No guessing, no `_To be confirmed_` clutter. Use ✅ Acceptance Criteria for a Feature or 📋 To Do for a Task, and omit it if no sub-items were given. Example: `Enhance Event detail: event name, booth name, booth number` →

```markdown
Title: Show event name, booth name and booth number on event detail

### 📌 Short Summary
Enhance the event detail page to show the event name, booth name and booth number.

### ✅ Acceptance Criteria
- [ ] Event name is shown
- [ ] Booth name is shown
- [ ] Booth number is shown

_Short issue — details to be added before work starts._
```

**Detailed:** classify first (step 3), then go through items **one at a time** (`Item 1 of 2`):

1. Restate the item in one line with its type: _"Feature: let staff customize what the customer display shows."_
2. Ask 2–4 focused questions, **each with a suggested answer**, so the user only corrects what's wrong. If the repo is available, check the code first (pages, models, field names) to make suggestions concrete.

   | Type | Ask about |
   |---|---|
   | Feature | Who uses it, and where in the app · What must be true when done (propose acceptance criteria) · Designs or constraints · Priority |
   | Bug | Steps to reproduce · Expected vs actual · Environment · Priority |
   | Task | Scope (propose a To Do list) · Done when · Priority |

3. Show the drafted body. The user replies `ok`, edits it, or says `skip` (skip = Short version for this item).
4. Move to the next item. When all are agreed, go on to step 6. The preview shows only the final table, not the questions again.

### 3. Classify

| Signal in the request | Type | Default label |
|---|---|---|
| error, broken, crash, wrong, regression, "doesn't work" | Bug | `bug` |
| add, new, support, allow, "as a user I want" | Feature | `enhancement` |
| update, upgrade, refactor, clean up, configure, docs | Task | `maintenance` / `documentation` |

Labels must already exist in the repo. Skip any that don't, and mention it in the report.

### 4. Title and body

**Title:**
- Imperative, specific, ≤ 70 characters: `Fix login redirect loop on expired session`
- Keep a ticket ID at the start if given: `UC-123: Add WMS picking screen`
- No trailing period, and no "Bug:" / "Feature:" prefix (the label says that)

**Body template:**
1. A repo template in `.github/ISSUE_TEMPLATE/` that matches the type:
   - `*.md`: fill the markdown sections; apply its front-matter `labels` / `assignees`.
   - `*.yml` (issue forms): render each `body` field as `### <label>` followed by the answer (that's how GitHub renders forms). The company forms installed from workflow-instructions use the same sections as the built-in templates.
2. Otherwise the built-in template: [Bug](templates/bug.md) · [Feature](templates/feature.md) · [Task](templates/task.md).

**Priority is never in the body.** It goes in the issue's Priority field (step 8). If a repo `.yml` form has a Priority dropdown, use its answer for the field and leave that section out of the body.

**Never invent facts.** Fill only what the user gave or what the repo proves. Mark missing parts `_To be confirmed_`; in the Detailed version, ask about them in step 2 instead.

Style: emoji headings as in our PR templates, **📌 Short Summary first, one sentence only**, bullets and checkboxes over paragraphs. Leave out optional sections that have no content.

### 5. Priority and Status

**Priority:** the user's words (or the form's Priority answer); otherwise infer; otherwise the config default (`Medium`).

| Priority | Use when |
|---|---|
| Urgent | Production down, security issue, data loss, customer blocked with no workaround |
| High | Blocks a release or another team; customer-facing bug with a workaround |
| Medium | Normal planned work (default) |
| Low | Nice-to-have, cosmetic, docs, tech debt with no current impact |

**Status:** `Backlog` by default. Use `Todo` when the user says it's ready, it's for this sprint, someone is assigned now, or the config default says so. Always show inferred values in the preview.

### 6. Duplicate check

```bash
gh issue list --repo <owner/repo> --state open --search "<2–4 title keywords> in:title" --limit 5 --json number,title,url
```

If there's a likely duplicate, show it in the preview and ask: create anyway, skip, or comment on the existing issue.

### 7. Preview and confirm

**Never create anything before the user confirms.** If they edit an item, go back to step 4 for that item and show the preview again.

```
📝 Issue preview — ai-deta/shop-api
   Title:     Fix login redirect loop on expired session
   Type:      Bug          Labels: bug
   Assignee:  —            Milestone: —
   Project:   ai-deta #3 "Delivery Board"
   Status:    Backlog      Priority: High (issue field)
   Possible duplicate: #87 "Login redirect issue" (open)

   <full body>

Create this issue? (yes / edit / cancel)
```

For bulk, show a table, and full bodies only on request:

```
| # | Title                         | Type    | Version  | Priority | Status  | Dup? |
|---|-------------------------------|---------|----------|----------|---------|------|
| 1 | Add CSV export to orders list | Feature | Short    | Medium   | Backlog | —    |
| 2 | Fix VAT rounding on invoices  | Bug     | Detailed | High     | Todo    | #112 |

Create all 2? (yes / edit <n> / remove <n> / cancel)
```

### 8. Create and set Priority

Write each body to a temp file (avoids shell escaping), then:

```bash
gh issue create --repo <owner/repo> --title "<title>" --body-file "$BODY_FILE" \
  [--label "<label>"] [--assignee "<login>"] [--milestone "<milestone>"]   # prints the issue URL
```

Right after each issue is created, set its Priority field: [reference/priority-field.md](reference/priority-field.md).

Bulk: create one at a time, in the previewed order. If one fails, continue with the rest and report the failures at the end. Never retry the whole batch, because that creates duplicates.

### 9. Link to the project

Follow [reference/project-linking.md](reference/project-linking.md) for each created issue. It sets Status, and Priority only as a fallback when the repo has no Priority issue field.

### 10. Report

```
✅ 2 of 2 issues created — Project: Delivery Board (ai-deta #3)
| #    | Title                         | Priority | Status  |
|------|-------------------------------|----------|---------|
| #124 | Add CSV export to orders list | Medium   | Backlog |
| #125 | Fix VAT rounding on invoices  | High     | Todo    |
Skipped: label `maintenance` not found in repo
```

For a single issue, show its URL, title, labels, Priority (and where it was set), and project with Status.

## Bulk rules

- Accept any list-like input: bullets, numbered lists, meeting notes, a feature breakdown, a pasted table.
- One issue per actionable item. Ignore discussion lines, decisions, and FYIs.
- Don't merge or split items on your own. If one looks like two pieces of work, suggest the split in the preview.
- More than 20 items: confirm in batches of 20.
- Shared values stated once ("all High, for Sprint 12", "assign to @dev") apply to every item.

## Edge cases

| Situation | Do |
|---|---|
| Project not found, or no access | Show `gh project list --owner <owner>` options and ask again |
| No Priority issue field (personal repo, or org hasn't added one) | Use the project's Priority field instead; if that's missing too, leave Priority unset and report it. Never put it in the body |
| Status field missing on the project | Link the issue, skip the field, report it |
| Option not found (e.g. no "Urgent") | Show the available options and ask which to use |
| Label, milestone, or assignee doesn't exist | Skip it; mention it in the report |
| Repo has `blank_issues_enabled: false` | Still allowed via the CLI; use the closest matching template |
| User wants a repo other than the current one | Pass `--repo <owner/repo>` to every command |
