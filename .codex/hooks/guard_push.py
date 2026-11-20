#!/usr/bin/env python3
"""Codex PreToolUse hook for Bash (wired in .codex/hooks.json):
deny `git push` while the current branch is a protected branch.
Requires Python 3.8+, standard library only."""
import json
import os
import re
import subprocess
import sys

PROTECTED = {"main", "master", "develop", "staging"}


def main():
    data = json.load(sys.stdin)
    command = (data.get("tool_input") or {}).get("command") or ""
    if not re.search(r"\bgit\b[^;&|\n]*\bpush\b", command):
        return 0
    cwd = data.get("cwd") or os.getcwd()
    branch = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=cwd,
                            capture_output=True, text=True, timeout=10).stdout.strip()
    if branch in PROTECTED:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": f"On protected branch '{branch}'. Create a feature branch, then push that.",
        }}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # never block work because the hook itself broke
        print(f"guard_push hook error: {exc}", file=sys.stderr)
        sys.exit(1)
