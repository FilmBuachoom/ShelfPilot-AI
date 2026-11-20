---
name: test
description: >
  Runs a hands-on test pass of a deployed (or local) web app in the browser and writes a
  report: release UAT (the default), a quick smoke pass, a regression pass, or one feature.
  Reads the project's .github/test-config.yml for hosts, accounts and checklists, discovers
  the build first (version, commit, hosts), asks for sign-ins once, works through the
  checklist with evidence (screens, API reads, code look-ups), verifies every bug against the
  code before reporting it, and ends with a go / no-go verdict, a report in docs/qa/ and an
  offer to file the bugs with /issue-create. Use when the user asks to test, UAT,
  smoke-test, QA, check a release, "do the test on staging", run a release checklist, or
  types /test.
argument-hint: "[uat|smoke|regression|feature <name>] [env=<name>] [pasted checklist]"
---

# Test

`/test {type} [env=…] [pasted checklist]` — a manual test pass that Codex drives in a browser
while the user signs in. One run = one report.

## Contents

- [Requirements](#requirements) · [Arguments](#arguments) · [Safety](#safety) ·
  [Workflow checklist](#workflow-checklist)
- Steps: [1 Config](#1-read-the-config) · [2 Discover](#2-discover-the-build) ·
  [3 Ask once](#3-ask-once) · [4 Plan](#4-plan) · [5 Run](#5-run-the-checklist) ·
  [6 Verify bugs](#6-verify-every-bug) · [7 Report](#7-report) · [8 Follow up](#8-follow-up)
- [Subagents](#subagents) · References: [reference/techniques.md](reference/techniques.md) ·
  [reference/pitfalls.md](reference/pitfalls.md) · [templates/report.md](templates/report.md) ·
  [templates/checklist.md](templates/checklist.md)

## Requirements

| Need | Check | If missing |
|---|---|---|
| A browser tool Codex can drive | The in-app browser pane, Codex in Chrome, or a Playwright MCP is listed among the tools | Ask the user to connect one; without it only step 2 can run |
| `curl`, `dig`, `git` | `command -v curl dig git` | Skip the checks that need them and say so |
| `gh` (for the follow-up) | `gh auth status` | Offer `/issue-create` later |
| `.github/test-config.yml` | Exists in the project | Step 1 builds one with the user |

## Arguments

| Argument | Values | Default | Means |
|---|---|---|---|
| `type` | `uat` · `smoke` · `regression` · `feature <name>` | `uat` | Which rows (below) |
| `env` | a key under `environments:` in the config | the first one | Where |
| checklist | pasted text | — | **Replaces** the stored checklist for this run. Keep its order and wording; reuse a "How" from the stored file where a row matches |

| Type | Rows |
|---|---|
| `uat` | The whole checklist file (`checklists.uat` in the config) |
| `smoke` | Section 1 ("Must pass") only |
| `regression` | Section 1, plus the rows touching what changed since the last release tag (`git log <last tag>..<branch>`) |
| `feature <name>` | Rows built from that feature's commits (`git log --grep`), its rule file in `.Codex/rules/` and matching checklist rows. Show the list before starting |

## Safety

- **Passwords.** Codex types a password only where the config says `sign_in: test-values`
  (local hosts, or hosts whose name carries `staging`/`dev`/`test`/`qa`/`sandbox`/`preview`)
  and only test values from the project's seed or example files. Everywhere else the **user
  signs in** in the browser Codex drives.
- **One browser = one session.** Signing up or in replaces the current account in that browser.
  A second account (invitee, guest, another role) needs a second browser — Codex in Chrome if
  connected, otherwise the user's own private window, following steps Codex writes out.
- **Extra accounts** use `accounts.extra` from the config; read their mail the way
  `accounts.mail` says, or ask.
- **Outward effects** (feedback pings, invitation mail, sign-ups) are part of a test the user
  asked for; label everything "QA …" / "please ignore".
- **Keep test data by default** and list it in the report. Delete or restore only on a yes. Note
  every setting you change as old → new.
- Never run destructive or load tests, and never test against production unless the config's
  environment is production **and** the user says so in this conversation.

## Workflow checklist

Copy into your reply and tick as you go (and into the task list, when the session has one):

```
- [ ] 1. Config read (or built with the user)
- [ ] 2. Build discovered: version, commit vs branch, hosts resolve, health, robots
- [ ] 3. One question round: sign-ins, extra accounts, admin, server logs
- [ ] 4. Rows chosen and mapped to a "How"; can't-run and stale rows marked
- [ ] 5. Rows run, evidence noted for each
- [ ] 6. Every bug reproduced, ruled out as environment, found in code
- [ ] 7. Report written, screenshots saved, verdict given
- [ ] 8. /issue-create offered
```

If step 6 turns a bug into "by design" or "environment", go back and fix its row in step 5's
notes before writing the report.

### 1. Read the config

Read `.github/test-config.yml` (keys are explained in its comments). Missing → copy the
skill's sample from the template repo's `github/test-config.yml`, fill hosts and branch with
the user, and offer to save it. Missing checklist file → offer to start one from
[templates/checklist.md](templates/checklist.md) (from the user's pasted list, if any).

### 2. Discover the build

Read-only, before asking anything:

1. **Build info**: `curl -s <app><build_info.page>` and grep each of `build_info.keys`
   (`grep -oE '(appVersion|appCommit)"?:"[^"]*"'`). Compare the commit with
   `git rev-parse --short <branch>`; a mismatch means the deploy is behind — say so first.
2. **Every host resolves** (`dig +short`): each of `urls`, plus any URL the build info names
   (site, docs). An unresolved host, or `localhost` in a deployed page's links
   (`curl -s <web> | grep -oE 'href="http[^"]*"'`), is a config bug.
3. `curl -s -o /dev/null -w '%{http_code}' <app><health>` → 2xx. Off production, the public
   site's `/robots.txt` should block crawling.
4. Server logs: look for an SSH alias only to **ask** about it — an alias may be production.

### 3. Ask once

One question round (up to four questions, each standing alone):

| Question | Why |
|---|---|
| Sign in to `accounts.test_shop` in the browser Codex drives — full or read-only? | Codex can't type that password |
| Extra accounts: which address, which browser? | Second session; mail |
| Sign in to the admin console too? | Admin-only rows |
| Server logs: give access, or check them yourself? | Log rows |

Then confirm the session from the page (`fetch('<session_check>')`). Re-check it whenever
results look empty.

### 4. Plan

Map each row to its "How" from the checklist file. Mark up front, don't fake:

- ⬜ **can't run here** — offline, a second physical device, an inbox only the user reads; say
  who can.
- ➖ **stale** — the feature left or moved in this release; cite the commit
  (`git log --oneline <prod-branch>..<branch> --grep <word>`).

### 5. Run the checklist

Order rows so later ones build on earlier ones (read-only first; settings changes before the
rows that check them; account and email rows last). For each row record **evidence** — a
record id, an API field, a screenshot path, a log line. Read results through the app's API
rather than trusting the screen ([reference/techniques.md](reference/techniques.md)); avoid the
traps in [reference/pitfalls.md](reference/pitfalls.md) and the checklist's own "Project traps".
Post a one-line progress note at each section change.

### 6. Verify every bug

Before a row becomes ❌:

1. **Reproduce** it once more (reload, another tab).
2. **Rule out the test environment**: wrong account in the session, stale tab, the automation
   (clicks during animations, blocked clipboard, background-tab captures), a date rollover in
   `timezone`, a value deliberately snapshotted.
3. **Find it in the code** (`file:line`, why) and read the matching `.Codex/rules/` file —
   "by design" is not a bug.
4. **Grade**: High (blocks release, money, sign-in, data), Medium (wrong, with a workaround),
   Low (cosmetic, copy, cut-off). Possibly-the-automation goes under "Not confirmed".

### 7. Report

Write `<report_dir>/<YYYY-MM-DD>-<env>-<type>.md` from [templates/report.md](templates/report.md)
(default structure — adapt sections to the checklist's). Save screenshots to
`<report_dir>/screenshots/<what>-<device>.jpg`. Don't commit unless asked.

**Verdict:** **No-go** for any High in the app. **Go with conditions** when the only Highs are
config the deploy can fix, or when section-1 rows are ⬜ — list exactly what to check by hand.
**Go** when section 1 is all ✅. Check the report against the workflow checklist; any row
without a result or evidence → back to step 5.

### 8. Follow up

Give the verdict, attach or paste the report (send the file if the session can), and offer
`/issue-create` for the bugs — one issue each, Low polish grouped into one — then add the issue
numbers to the report's bug table. After the run, offer to fold new "How"s and traps into the
checklist file so the next run is faster.

## Subagents

The browser holds **one session** — never give it to two agents. Use subagents only for
independent, read-only work while you drive it: finding the code behind a suspected bug,
reading the release scope for stale rows, drafting issue bodies. Brief each narrowly and check
what comes back before it goes in the report.
