#!/usr/bin/env python3
"""Codex PreToolUse hook for file edits (apply_patch): block edits to sensitive files.

Wired in .codex/hooks.json (matcher apply_patch|Edit|Write). Codex passes the patch
text in tool_input.command; Claude-style tool_input.file_path is also understood.
Requires Python 3.8+, standard library only.

Edit the lists below per project. Each entry is (regex on the repo-relative path,
reason shown to the agent and the user).

Codex hooks cannot ask the user: "deny" blocks the edit, while ASK entries only add
a reminder to the agent's context (the "Ask first" list in AGENTS.md still applies).

Project addition: CONTENT_DENY checks the text being written, so an OpenAI key or a
client-side OpenAI call is refused before it lands in any file.
"""
import json
import os
import re
import subprocess
import sys

# Never gated, checked first.
ALLOW = [
    r"(^|/)\.env(\.[^/]*)?\.(example|sample|template)$",
]

# Always refused.
DENY = [
    (r"(^|/)\.env(\.[^/]*)?$",
     "Env files hold secrets. Edit .env.example instead and tell the user which variables to set."),
]

# Project-specific paths the agent must never edit, e.g. vendored third-party addons.
PROJECT_DENY = [
    # (r"^addons/l10n_th_vendor/", "Third-party addon — extend it from a custom addon instead."),
]

# Allowed only after the user approves.
ASK = [
    (r"(^|/)\.codex/",
     "This file enforces the project's safety rules."),
    (r"(^|/)next\.config\.(js|mjs|ts)$",
     "Global Next.js config."),
    (r"^schemas/",
     "JSON Schema is the shared contract between Python and TypeScript — update both sides in the same change."),
]

# Asked only when the file already exists: creating seed data is fine, rewriting
# the real catalog or a user's shelf by hand is not.
ASK_IF_EXISTS = [
    (r"^data/[^/]+\.json$",
     "Real catalog / shelf data. Catalog accuracy is the metric — never invent entries; changes should come from the ingest pipeline or the user."),
]

# Project addition. Refused whatever the path (except ALLOW). Checked on the text
# being written. (pattern, reason, also_in_docs): docs, .agents/ and .codex/ may
# *mention* the code patterns (AGENTS.md, rules, this hook), but never hold a real key.
CONTENT_DENY = [
    (re.compile(r"\bsk-(proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}"),
     "Looks like a literal OpenAI API key. Read it from process.env.OPENAI_API_KEY / os.environ instead.",
     True),
    (re.compile(r"NEXT_PUBLIC_[A-Z0-9_]*OPENAI"),
     "NEXT_PUBLIC_ variables ship to the browser. Keep the OpenAI key server-side (API route / Python).",
     False),
    (re.compile(r"dangerouslyAllowBrowser"),
     "Calling OpenAI from the browser exposes the key. Call it from a Next.js API route instead.",
     False),
]
DOCS = re.compile(r"(\.md$|^\.(agents|codex)/)")


def written_text(tool_input):
    """The text a Claude-style Write/Edit/MultiEdit/NotebookEdit call would put in the file."""
    parts = [tool_input.get("content"), tool_input.get("new_string"), tool_input.get("new_source")]
    for edit in tool_input.get("edits") or []:
        parts.append(edit.get("new_string"))
    return "\n".join(p for p in parts if isinstance(p, str))


PATCH_FILE = re.compile(r"^\*\*\* (Add|Update|Delete) File: (.+)$")
PATCH_MOVE = re.compile(r"^\*\*\* Move to: (.+)$")


def patch_targets(patch):
    """[(path, added text)] for every file an apply_patch payload touches."""
    targets, current = [], None
    for line in patch.split("\n"):
        header = PATCH_FILE.match(line) or PATCH_MOVE.match(line)
        if header:
            current = [header.group(header.lastindex).strip(), []]
            targets.append(current)
        elif current is not None and line.startswith("+"):
            current[1].append(line[1:])
    return [(path, "\n".join(lines)) for path, lines in targets]


def edit_targets(tool_input):
    """[(path, text)] from a Codex apply_patch call or a Claude-style edit call."""
    path = tool_input.get("file_path") or tool_input.get("notebook_path")
    if path:
        return [(path, written_text(tool_input))]
    patch = tool_input.get("command") or tool_input.get("input") or tool_input.get("patch") or ""
    if isinstance(patch, list):
        patch = "\n".join(str(p) for p in patch)
    return patch_targets(patch) if isinstance(patch, str) else []


def repo_root(cwd):
    try:
        out = subprocess.run(["git", "rev-parse", "--show-toplevel"], cwd=cwd,
                             capture_output=True, text=True, timeout=10)
        return out.stdout.strip() or cwd
    except (OSError, subprocess.TimeoutExpired):
        return cwd


def decide(rel_path, exists, text=""):
    if any(re.search(pattern, rel_path) for pattern in ALLOW):
        return None, None
    for pattern, reason in DENY + PROJECT_DENY:
        if re.search(pattern, rel_path):
            return "deny", reason
    is_doc = bool(DOCS.search(rel_path))
    for pattern, reason, also_in_docs in CONTENT_DENY:
        if (also_in_docs or not is_doc) and pattern.search(text):
            return "deny", reason
    for pattern, reason in ASK:
        if re.search(pattern, rel_path):
            return "ask", reason
    if exists:
        for pattern, reason in ASK_IF_EXISTS:
            if re.search(pattern, rel_path):
                return "ask", reason
    return None, None


def main():
    data = json.load(sys.stdin)
    tool_input = data.get("tool_input") or {}
    cwd = data.get("cwd") or os.getcwd()
    root = repo_root(cwd)
    asks = []
    for path, text in edit_targets(tool_input):
        abs_path = os.path.normpath(os.path.join(cwd, path))
        rel_path = os.path.relpath(abs_path, root).replace(os.sep, "/")
        decision, reason = decide(rel_path, os.path.exists(abs_path), text)
        if decision == "deny":
            print(json.dumps({
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"{rel_path}: {reason}",
                }
            }))
            return 0
        if decision == "ask":
            asks.append(f"{rel_path}: {reason}")
    if asks:  # Codex cannot ask: remind the agent instead of failing the hook
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "additionalContext": "ASK FIRST (AGENTS.md): " + " ".join(asks) +
                                     " Confirm with the user in chat if you have not already.",
            }
        }))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # never block work because the hook itself broke
        print(f"protect_files hook error: {exc}", file=sys.stderr)
        sys.exit(1)
