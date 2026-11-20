#!/usr/bin/env python3
"""PreToolUse hook for Edit/Write: block or gate edits to sensitive files.

Wired in .claude/settings.json. Reads the tool call as JSON on stdin and prints a
permission decision. Requires Python 3.8+, standard library only.

Edit the lists below per project. Each entry is (regex on the repo-relative path,
reason shown to Claude and the user).
"""
import json
import os
import re
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

# Project-specific paths Claude must never edit, e.g. vendored third-party addons.
PROJECT_DENY = [
    # (r"^addons/l10n_th_vendor/", "Third-party addon — extend it from a custom addon instead."),
]

# Allowed only after the user approves.
ASK = [
    (r"(^|/)\.claude/(settings\.json|hooks/)",
     "This file enforces the project's safety rules."),
    (r"(^|/)next\.config\.(js|mjs|ts)$",
     "Global Next.js config."),
]

# Asked only when the file already exists: new migrations are fine, rewriting
# applied ones is not (except when squashing).
ASK_IF_EXISTS = [
]


def decide(rel_path, exists):
    if any(re.search(pattern, rel_path) for pattern in ALLOW):
        return None, None
    for pattern, reason in DENY + PROJECT_DENY:
        if re.search(pattern, rel_path):
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
    path = tool_input.get("file_path") or tool_input.get("notebook_path")
    if not path:
        return 0
    root = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()
    abs_path = os.path.normpath(os.path.join(root, path))
    rel_path = os.path.relpath(abs_path, root).replace(os.sep, "/")

    decision, reason = decide(rel_path, os.path.exists(abs_path))
    if decision:
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": decision,
                "permissionDecisionReason": f"{rel_path}: {reason}",
            }
        }))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # never block work because the hook itself broke
        print(f"protect_files hook error: {exc}", file=sys.stderr)
        sys.exit(1)
