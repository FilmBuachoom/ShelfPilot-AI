---
name: pr-screenshots
description: >
  Captures, uploads, and embeds screenshots of UI changes for a pull request in the
  style the user picks: Default (one desktop shot per screen), Before-After (base vs
  branch, side by side), or Responsive (Desktop, Tablet, Smartphone). Use when the
  user wants screenshots for a PR, or when pr-description or pr-create gets a "yes"
  to its screenshot question. Not for screenshots unrelated to a PR or issue.
argument-hint: "[1|2|3] [app-url]"
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/capture.py *), Bash(git rev-parse *), Bash(git status *), Bash(git diff *), Bash(gh repo view *)
---

# PR screenshots

## Contents

- [Requirements](#requirements) · [Commands](#commands) · [Workflow checklist](#workflow-checklist)
- Steps: [1 Style](#1-choose-the-style) · [2 Screens](#2-list-the-screens-and-the-app-url) · [3 Capture](#3-capture) · [4 Upload](#4-upload) · [5 Embed](#5-embed) · [6 Verify](#6-verify)
- [Edge cases](#edge-cases)

## Requirements

- `gh`, authenticated, for the upload (`brew install gh` / `sudo apt install gh` / `winget install GitHub.cli`, then `gh auth login`).
- Playwright, only to capture: `npm i -D playwright && npx playwright install chromium`, or `pip install playwright && python3 -m playwright install chromium`. Without it, ask the user for the images.
- **Never commit screenshots**, on any branch or folder. They go to the `pr-assets` Release (a GitHub Release used as a file store).

## Commands

| Task | Command |
|---|---|
| Capture | `${CLAUDE_SKILL_DIR}/scripts/capture.py <url> --name <slug> --out /tmp/pr-shots-<branch> [--devices desktop,tablet,phone] [--full-page] [--selector <css>] [--wait-ms 3000] [--storage-state <file>]` |
| Repo name | `gh repo view --json nameWithOwner -q .nameWithOwner` |
| Upload (all files, one call) | `${CLAUDE_SKILL_DIR}/scripts/upload_screenshot.sh <owner>/<repo> <file>...` |

`capture.py` prints `<device><TAB><file>` per shot and refuses to write inside the repo. `upload_screenshot.sh` prints `<file><TAB><url>` per image.

## Workflow checklist

Copy this into your reply and tick items as you go:

```
- [ ] 1. Style chosen by the user
- [ ] 2. Screens and app URL confirmed
- [ ] 3. Captured, and each image checked
- [ ] 4. Uploaded
- [ ] 5. Markdown block built in the style's layout
- [ ] 6. Verification passed
```

## 1. Choose the style

If the caller (pr-description, pr-create), `$ARGUMENTS`, or the request already names a style, use it. Otherwise ask this, then **stop and wait**:

```
Which screenshot style?
1. Default: one screenshot of each changed screen (desktop)
2. Before-After: each screen on <base> and on this branch, side by side
3. Responsive: each screen on Desktop, Tablet, and Smartphone
```

## 2. List the screens and the app URL

Map the changed files to screens. Up to 3 screens unless the user asks for more.

| Changed file | Screen |
|---|---|
| Nuxt `pages/orders/index.vue`, `pages/orders/[id].vue` | `/orders`, `/orders/<an existing id>` |
| Component, composable, CSS | A page that uses it (grep for the component name) |
| Django template or view | Its route in `urls.py` |
| Odoo `views/*.xml`, `static/src/` | The menu or action; ask the user for the URL |

App URL: from the request or AGENTS.md; otherwise ask (e.g. `http://localhost:3000`). Ask for anything missing in **one** message, listing the screens you picked so the user can correct them, then wait. If the app isn't running, ask the user to start it.

## 3. Capture

Use one `--out /tmp/pr-shots-<branch>` folder for every shot, and `<slug>` = a short screen name (`orders-list`).

| Style | Run per screen | Files |
|---|---|---|
| 1 Default | `capture.py <app>/<path> --name <slug>` | `<slug>-desktop.png` |
| 2 Before-After | `capture.py <before-app>/<path> --name <slug>-before`, then `capture.py <app>/<path> --name <slug>-after` | `<slug>-before-desktop.png`, `<slug>-after-desktop.png` |
| 3 Responsive | `capture.py <app>/<path> --name <slug> --devices desktop,tablet,phone` | `<slug>-desktop.png`, `-tablet.png`, `-phone.png` |

**Before source** (style 2), the first that works:

1. Before images the user gave.
2. An environment that runs `<base>` (staging): ask for its URL, use the same path.
3. Local, only if `git status --porcelain` is empty, the dev server reloads on file changes (Nuxt/Vite, Django `runserver`), and the diff has no migration or dependency change: `git switch <base>`, capture *before*, `git switch -`, capture *after*. Pass `--wait-ms 3000` so the reload finishes. Always switch back, even when a capture fails.
4. A screen that is new on this branch has no before: write `_New screen_` in the Before cell.

**Check every image** (open it): it must show the intended screen, fully loaded. A login page, error page, blank page, or spinner → fix and capture again: longer `--wait-ms`, a `--selector` for one component, or a login (see [Edge cases](#edge-cases)).

## 4. Upload

Get `<owner>/<repo>` with `gh repo view`, then upload **every** file in one `upload_screenshot.sh` call. It stages the files outside the repo under unique names.

If the upload fails (token lacks `contents: write`, or releases are disabled), don't commit the images anywhere. List the local file paths and ask the user to drag them into the PR editor on GitHub (it hosts them under `github.com/user-attachments/assets/…`), or to paste the generated lines back so you can add them.

## 5. Embed

Use the layout for the style **exactly**, one block per screen, in the template's Screenshots section (replace its placeholder). Caption = screen name and path.

**1 Default**

```markdown
**Orders list (`/orders`)**
![Orders list](https://github.com/org/repo/releases/download/pr-assets/screenshot-1700000000-1-orders-list-desktop.png)
```

**2 Before-After**

```markdown
**Orders list (`/orders`)**

| Before | After |
|:---:|:---:|
| ![Before](<before-url>) | ![After](<after-url>) |
```

**3 Responsive**: fixed widths keep the three shots the same height.

```markdown
**Orders list (`/orders`)**

| Desktop | Tablet | Smartphone |
|:---:|:---:|:---:|
| <img src="<desktop-url>" width="440" alt="Desktop"> | <img src="<tablet-url>" width="240" alt="Tablet"> | <img src="<phone-url>" width="150" alt="Smartphone"> |
```

Called on its own (not from pr-description): show the block in the reply. If the branch already has a PR, offer to put it in the PR body's Screenshots section with `gh pr edit <number> --body-file <file>`.

## 6. Verify

Check each item. On a failure, go back to the step shown, fix it, and run the whole list again:

- [ ] The style is the one the user chose → else step 1
- [ ] Every listed screen has all its images (Before-After: 2, or `_New screen_`; Responsive: 3) → else step 3
- [ ] Every image was opened and shows the right screen, loaded → else step 3
- [ ] Every image link is an `https://` URL, never a local path → else step 4
- [ ] `git status --porcelain` shows no image files, and you're back on the feature branch → delete or unstage them; `git switch <branch>`
- [ ] Each block matches its style's layout in step 5 → else step 5

## Edge cases

| Situation | Do |
|---|---|
| No Playwright, and the user won't install it | Ask for the images (paste, path, or URL); go to step 4 |
| A browser tool is available instead (e.g. Playwright MCP) | Use it with the same viewports: Desktop 1440×900, Tablet 768×1024, Smartphone 390×844. Save files outside the repo. |
| Page needs a login | Ask for a Playwright storage-state file (the user runs `npx playwright codegen --save-storage=/tmp/pr-auth.json <url>`, logs in, closes it), then pass `--storage-state`. Never put passwords in commands or files. |
| User gave images that are already hosted (`https://`) | Skip steps 3 and 4 |
| Long page | `--full-page`, or `--selector` for the changed part |
| Change shows only after a click (dialog, menu) | Ask the user for the images, or use a browser tool to click first |
