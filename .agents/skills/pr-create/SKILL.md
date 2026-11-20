---
name: pr-create
description: >
  Creates a GitHub pull request from the current branch with the gh CLI: generated
  title and description, optional screenshots of UI changes, labels from the branch
  prefix, draft detection, and linked issues. Use when the user asks to create, open, raise, or submit a PR, including
  short requests like "PR this" or "push PR".
argument-hint: "[base-branch]"
allowed-tools: Bash(git branch *), Bash(git log *), Bash(git rev-parse *), Bash(gh auth status), Bash(gh repo view *)
---

# Create PR

## Requirements

- `gh` CLI, authenticated. Check with `gh auth status`. If it's missing, stop and tell the user how to install it:
  - macOS `brew install gh` · Ubuntu `sudo apt install gh` · Windows `winget install GitHub.cli`
  - then `gh auth login`
- A project hook (`.codex/hooks/guard_push.py`) blocks `git push` from `main`, `master`, `develop`, or `staging`. Create a feature branch first.

## Workflow checklist

Copy this into your reply and tick items as you go:

```
- [ ] 1. gh ready, on a feature branch
- [ ] 2. Base branch confirmed by the user
- [ ] 3. Title + body generated (pr-description), screenshots asked for UI changes
- [ ] 4. PR created by the script
- [ ] 5. Result reported
```

### 1. Preflight

Run `gh auth status` and `git rev-parse --abbrev-ref HEAD`. On a protected branch (`main`, `master`, `develop`, `staging`), ask the user for a feature branch name, then create and switch to it before going on.

### 2. Base branch

If `$ARGUMENTS` names a branch, use it. Otherwise **always ask** ("Which branch should this PR merge into?") and list the candidates from `git branch -r`. Never assume.

### 3. Title and body

Follow the **pr-description** skill (`.agents/skills/pr-description/SKILL.md`), steps 2–8, with the base branch from step 2. Its step 5 asks whether the user wants screenshots of a UI change and in which style; wait for the answer before creating the PR. Also:

- Issue links: `#NNN` in the branch name, or `Closes/Fixes #NNN` in commits → `Closes #NNN` in Related Issues. Non-GitHub IDs (`UC-123`) → plain text.
- Write the body to a temp file, e.g. `/tmp/pr-body-<branch>.md`.
- Screenshots go to the `pr-assets` Release (pr-screenshots skill). Never commit them to the repo; there is no `.github/pr-assets/` folder.

If verification (pr-description step 8) fails, fix the body before going on. Don't create a PR with an unfinished body.

### 4. Create

The script pushes the branch, picks the label and draft state, skips labels the repo doesn't have, and refuses protected or empty branches:

```bash
.agents/skills/pr-create/scripts/create_pr.sh <base> "<title>" /tmp/pr-body-<branch>.md [--draft]
```

Pass `--draft` only when the user said "draft" or "WIP". The script also detects `wip/` and `draft/` branches and `[WIP]` / `[DRAFT]` commits. Don't rebuild this logic by hand with `gh pr create`.

| Branch prefix | Label |
|---|---|
| `feature/`, `feat/` | `enhancement` |
| `fix/`, `hotfix/` | `bug` |
| `docs/` | `documentation` |
| `chore/`, `refactor/` | `maintenance` |
| `release/` | `release` |
| `wip/`, `draft/` | `WIP` (+ draft) |

### 5. Report

```
✅ PR created
   URL:    <url>
   Title:  <title>
   Base:   <base> ← <branch>
   Labels: <labels or "none (label X not in repo)">
   Draft:  Yes/No
   Issues: <Closes #N or —>
```

## Script results

| Output / exit code | Meaning | Do |
|---|---|---|
| `EXISTS <url>` | A PR is already open for this branch | Show the link; offer to update its description with `gh pr edit --body-file` |
| exit 2 | gh missing or not authenticated, or protected/same branch | Tell the user the exact fix |
| exit 3 | No commits ahead of base | "Nothing to PR." and stop |
| `NOTE label … skipped` | Label not in the repo | Mention it in the report |
