#!/usr/bin/env python3
"""PreToolUse hook for Bash: enforce the rules that must never be missed.

Wired in .claude/settings.json. Requires Python 3.8+, standard library only.

  deny  bypassing git hooks on commit/push (--no-verify, -n, core.hooksPath,
                                          SKIP=/HUSKY= env vars)
  deny  committing .env files            (secrets)
  deny  committing likely secrets        (high-confidence patterns; pre-commit
                                          gitleaks does the thorough scan)
  ask   adding a dependency              (pip/uv/poetry/npm/pnpm/yarn/bun)
  ask   git push --force                 (rewrites shared history)
"""
import json
import os
import re
import shlex
import subprocess
import sys

ENV_FILE = re.compile(r"(^|/)\.env(\.[^/]*)?$")
ENV_EXAMPLE = re.compile(r"(^|/)\.env(\.[^/]*)?\.(example|sample|template)$")

SECRET_PATTERNS = [
    ("private key", re.compile(r"-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY")),
    ("AWS access key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("GitHub token", re.compile(r"\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})")),
    ("Slack token", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}")),
    ("Stripe live key", re.compile(r"\b[sr]k_live_[A-Za-z0-9]{20,}")),
    ("Anthropic/OpenAI key", re.compile(r"\bsk-(ant|proj)-[A-Za-z0-9_-]{20,}")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}")),
    ("Discord webhook", re.compile(r"discord(app)?\.com/api/webhooks/\d+/[\w-]{20,}")),
]

PIP_FLAGS_WITH_VALUE = {"-r", "--requirement", "-c", "--constraint", "-e", "--editable",
                        "-t", "--target", "-i", "--index-url", "--extra-index-url"}
NOT_DEPENDENCIES = {"pip", "setuptools", "wheel"}
GIT_OPTS_WITH_VALUE = {"-C", "-c", "--git-dir", "--work-tree", "--namespace"}
BYPASS = "This skips the project's git hooks (the safety checks). Fix the failing check instead."


def segments(command):
    """Split a shell command into simple commands (token lists)."""
    text = command.replace("\n", " ; ")
    try:
        lexer = shlex.shlex(text, posix=True, punctuation_chars=True)
        lexer.whitespace_split = True
        tokens = list(lexer)
    except ValueError:  # unbalanced quotes, e.g. inside a heredoc
        tokens = text.split()
    current = []
    for tok in tokens:
        if tok and set(tok) <= set(";&|()"):
            if current:
                yield current
            current = []
        else:
            current.append(tok)
    if current:
        yield current


def short_flags(args):
    """Letters of short-option clusters: ['-am', '-n'] -> 'amn'."""
    return "".join(a[1:] for a in args if re.fullmatch(r"-[A-Za-z]+", a))


def bypasses_hooks(seg, args):
    """--no-verify, -c core.hooksPath=…, or SKIP=/HUSKY= env vars before git."""
    if "--no-verify" in args or "core.hookspath" in " ".join(seg).lower():
        return True
    return any(re.match(r"(SKIP|HUSKY)=", tok) for tok in seg)


def git_call(seg):
    """Return (subcommand, args, -C dir) for a git invocation, else None."""
    for i, tok in enumerate(seg):
        if os.path.basename(tok) != "git":
            continue
        j, workdir = i + 1, None
        while j < len(seg) and seg[j].startswith("-"):
            if seg[j] in GIT_OPTS_WITH_VALUE and j + 1 < len(seg):
                if seg[j] == "-C":
                    workdir = seg[j + 1]
                j += 1
            j += 1
        if j < len(seg):
            return seg[j], seg[j + 1:], workdir
    return None


def added_packages(seg):
    """Packages a command would add as dependencies (empty if none)."""
    for i, tok in enumerate(seg):
        name, rest = os.path.basename(tok), seg[i + 1:]
        if name in ("pip", "pip3") and rest[:1] == ["install"]:
            args, pip = rest[1:], True
        elif name.startswith("python") and rest[:3] == ["-m", "pip", "install"]:
            args, pip = rest[3:], True
        elif name == "uv" and rest[:2] == ["pip", "install"]:
            args, pip = rest[2:], True
        elif name in ("uv", "poetry", "pnpm", "yarn", "bun") and rest[:1] == ["add"]:
            args, pip = rest[1:], False
        elif name in ("npm", "pnpm", "bun") and rest[:1] in (["install"], ["i"], ["add"]):
            args, pip = rest[1:], False
        else:
            continue
        packages, skip = [], False
        for arg in args:
            if skip:
                skip = False
            elif arg.startswith("-"):
                skip = pip and arg in PIP_FLAGS_WITH_VALUE
            elif not arg.startswith((".", "/")) and arg not in NOT_DEPENDENCIES:
                packages.append(arg)
        return packages
    return []


def git_out(cwd, *args):
    try:
        result = subprocess.run(["git", *args], cwd=cwd, capture_output=True,
                                text=True, errors="replace", timeout=10)
    except (OSError, subprocess.TimeoutExpired):
        return ""
    return result.stdout if result.returncode == 0 else ""


def pending_changes(cwd, add_specs, commit_all):
    """Files and added lines the commit would include: staged changes plus what a
    `git add` earlier in the same command, or `commit -a`, would stage.
    Paths are relative to the repo root, as git prints them."""
    top = git_out(cwd, "rev-parse", "--show-toplevel").strip() or cwd
    prefix = git_out(cwd, "rev-parse", "--show-prefix").strip()
    files = set(git_out(cwd, "diff", "--cached", "--name-only").split("\n"))
    diff = git_out(cwd, "diff", "--cached", "-U0")

    targets = []  # (repo-relative path or "" for the whole repo, include untracked?)
    for spec in add_specs:
        if spec in ("-A", "--all", "-u", "--update"):
            targets.append(("", spec in ("-A", "--all")))
        else:
            target = os.path.normpath(os.path.join(prefix, spec)).replace(os.sep, "/")
            targets.append(("" if target == "." else target, True))
    extra = {t for t, _ in targets if ENV_FILE.search(t)}  # `git add -f .env`

    if targets or commit_all:
        for line in git_out(cwd, "status", "--porcelain", "-uall").split("\n"):
            if len(line) < 4:
                continue
            path = line[3:].split(" -> ")[-1].strip('"')
            untracked = line.startswith("??")
            if commit_all and not untracked:
                extra.add(path)
            for target, with_untracked in targets:
                if (not target or path == target or path.startswith(target + "/")) \
                        and (with_untracked or not untracked):
                    extra.add(path)

    for path in extra - files:
        full = os.path.join(top, path)
        if os.path.isfile(full) and os.path.getsize(full) < 1_000_000:
            try:
                with open(full, encoding="utf-8", errors="replace") as fh:
                    diff += f"\n+++ b/{path}\n" + "".join("+" + l for l in fh)
            except OSError:
                pass
    return {f for f in files | extra if f}, diff


def scan_secrets(diff):
    hits, current = [], "?"
    for line in diff.split("\n"):
        if line.startswith("+++ "):
            current = line[6:] if line.startswith("+++ b/") else line[4:]
        elif line.startswith("+"):
            for label, pattern in SECRET_PATTERNS:
                if pattern.search(line):
                    hits.append(f"{current} ({label})")
    return sorted(set(hits))


def check(command, cwd):
    denies, asks, add_specs = [], [], []
    for seg in segments(command):
        packages = added_packages(seg)
        if packages:
            asks.append("Adds dependencies: " + ", ".join(packages) +
                        ". Company rule: ask before adding a dependency.")
        call = git_call(seg)
        if not call:
            continue
        sub, args, workdir = call
        flags = short_flags(args)
        if sub == "add":
            add_specs += [a for a in args if not a.startswith("-") or a in ("-A", "--all", "-u", "--update")]
        elif sub == "push":
            if bypasses_hooks(seg, args):
                denies.append(BYPASS)
            if any(a.startswith("--force") for a in args) or "f" in flags \
                    or any(a.startswith("+") for a in args):
                asks.append("Force push rewrites shared history.")
        elif sub == "commit":
            if bypasses_hooks(seg, args) or "n" in flags:
                denies.append(BYPASS)
            git_cwd = os.path.join(cwd, workdir) if workdir else cwd
            files, diff = pending_changes(git_cwd, add_specs, "--all" in args or "a" in flags)
            env_files = sorted(f for f in files if ENV_FILE.search(f) and not ENV_EXAMPLE.search(f))
            if env_files:
                denies.append("Commit would include env files: " + ", ".join(env_files) +
                              ". Unstage them (git restore --staged <file>) and add them to .gitignore.")
            secrets = scan_secrets(diff)
            if secrets:
                denies.append("Possible secrets in: " + ", ".join(secrets) +
                              ". Move them to env vars/config, and rotate any key that was ever pushed.")
    if denies:
        return "deny", " ".join(denies)
    if asks:
        return "ask", " ".join(asks)
    return None, None


def main():
    data = json.load(sys.stdin)
    command = (data.get("tool_input") or {}).get("command") or ""
    cwd = data.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    decision, reason = check(command, cwd)
    if decision:
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": decision,
                "permissionDecisionReason": reason,
            }
        }))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # never block work because the hook itself broke
        print(f"guard_bash hook error: {exc}", file=sys.stderr)
        sys.exit(1)
