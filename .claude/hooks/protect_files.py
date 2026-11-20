#!/usr/bin/env python3
"""PreToolUse hook for Edit/Write: block or gate edits to sensitive files.

Wired in .claude/settings.json. Reads the tool call as JSON on stdin and prints a
permission decision. Requires Python 3.8+, standard library only.

Edit the lists below per project. Each entry is (regex on the repo-relative path,
reason shown to Claude and the user).

Project addition: CONTENT_DENY checks the text being written, so an OpenAI key or a
client-side OpenAI call is refused before it lands in any file.
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

# Project addition. Refused whatever the path (except ALLOW). Checked on the text
# being written. (pattern, reason, also_in_docs): docs and .claude/ may *mention*
# the code patterns (CLAUDE.md, rules, this hook), but never hold a real key.
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
DOCS = re.compile(r"(\.md$|^\.claude/)")


def written_text(tool_input):
    """The text a Write/Edit/MultiEdit/NotebookEdit call would put in the file."""
    parts = [tool_input.get("content"), tool_input.get("new_string"), tool_input.get("new_source")]
    for edit in tool_input.get("edits") or []:
        parts.append(edit.get("new_string"))
    return "\n".join(p for p in parts if isinstance(p, str))


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
    path = tool_input.get("file_path") or tool_input.get("notebook_path")
    if not path:
        return 0
    root = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()
    abs_path = os.path.normpath(os.path.join(root, path))
    rel_path = os.path.relpath(abs_path, root).replace(os.sep, "/")

    decision, reason = decide(rel_path, os.path.exists(abs_path), written_text(tool_input))
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
