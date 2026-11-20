#!/usr/bin/env python3
"""Capture screenshots of one page at fixed device sizes, into a folder outside the repo.

Usage:
  capture.py <url> [--name SLUG] [--devices desktop,tablet,phone] [--out DIR]
             [--full-page] [--selector CSS] [--wait-ms N] [--storage-state FILE] [--dry-run]

Prints one "<device><TAB><file>" line per screenshot. Files are named <slug>-<device>.png.
Uses Playwright for Python if installed, else Playwright for Node (`require('playwright')`).
Exit codes: 0 ok, 1 bad arguments, 2 no Playwright, 3 capture failed.
"""
import argparse
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

DEVICES = {
    "desktop": {"width": 1440, "height": 900, "scale": 1, "mobile": False},
    "tablet": {"width": 768, "height": 1024, "scale": 2, "mobile": True},
    "phone": {"width": 390, "height": 844, "scale": 2, "mobile": True},
}

INSTALL_HINT = """No Playwright found. Install one of:
  Node:   npm i -D playwright && npx playwright install chromium
  Python: pip install playwright && python3 -m playwright install chromium
Or attach the screenshots yourself."""

NODE_RUNNER = r"""
const plan = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const s of plan.shots) {
      const ctx = await browser.newContext({
        viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.scale,
        isMobile: s.mobile, hasTouch: s.mobile, storageState: plan.storage_state || undefined });
      const page = await ctx.newPage();
      await page.goto(plan.url, { waitUntil: 'load', timeout: plan.timeout });
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(plan.wait_ms);
      if (plan.selector) await page.locator(plan.selector).first().screenshot({ path: s.path });
      else await page.screenshot({ path: s.path, fullPage: plan.full_page });
      await ctx.close();
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e.message); process.exit(3); });
"""


def slug_of(url):
    path = urlparse(url).path.strip("/")
    return re.sub(r"[^A-Za-z0-9_-]+", "-", path).strip("-") or "home"


def repo_top():
    result = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True)
    return Path(result.stdout.strip()).resolve() if result.returncode == 0 else None


def build_plan(args):
    devices = [d.strip() for d in args.devices.split(",") if d.strip()]
    unknown = [d for d in devices if d not in DEVICES]
    if unknown or not devices:
        sys.exit(f"unknown device(s): {', '.join(unknown) or '(none)'}. Use: {', '.join(DEVICES)}")
    out = Path(args.out).resolve() if args.out else Path(tempfile.mkdtemp(prefix="pr-shots-"))
    top = repo_top()
    if top and (out == top or top in out.parents):
        sys.exit(f"refusing to write inside the repository ({top}). Screenshots must never be committed; "
                 "omit --out or pick a folder outside the repo.")
    name = re.sub(r"[^A-Za-z0-9_-]+", "-", args.name).strip("-") if args.name else slug_of(args.url)
    shots = [{"device": d, **DEVICES[d], "path": str(out / f"{name}-{d}.png")} for d in devices]
    return {"url": args.url, "shots": shots, "full_page": args.full_page, "selector": args.selector,
            "wait_ms": args.wait_ms, "timeout": 30000, "storage_state": args.storage_state, "out": str(out)}


def backend():
    if importlib.util.find_spec("playwright"):
        return "python"
    if shutil.which("node") and subprocess.run(["node", "-e", "require.resolve('playwright')"],
                                               capture_output=True).returncode == 0:
        return "node"
    return None


def capture_python(plan):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            for s in plan["shots"]:
                ctx = browser.new_context(viewport={"width": s["width"], "height": s["height"]},
                                          device_scale_factor=s["scale"], is_mobile=s["mobile"],
                                          has_touch=s["mobile"], storage_state=plan["storage_state"])
                page = ctx.new_page()
                page.goto(plan["url"], wait_until="load", timeout=plan["timeout"])
                try:
                    page.wait_for_load_state("networkidle", timeout=5000)
                except Exception:
                    pass  # pages with long polling never go idle; the fixed wait below covers them
                page.wait_for_timeout(plan["wait_ms"])
                if plan["selector"]:
                    page.locator(plan["selector"]).first.screenshot(path=s["path"])
                else:
                    page.screenshot(path=s["path"], full_page=plan["full_page"])
                ctx.close()
        finally:
            browser.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("url")
    ap.add_argument("--name", help="file name prefix (default: from the URL path)")
    ap.add_argument("--devices", default="desktop", help=f"comma-separated: {', '.join(DEVICES)}")
    ap.add_argument("--out", help="folder outside the repo (default: a new temp folder)")
    ap.add_argument("--full-page", action="store_true", help="whole scrollable page, not only the viewport")
    ap.add_argument("--selector", help="capture only the first element matching this CSS selector")
    ap.add_argument("--wait-ms", type=int, default=1000, help="extra wait after load (default 1000)")
    ap.add_argument("--storage-state", help="Playwright storage state JSON for pages behind a login")
    ap.add_argument("--dry-run", action="store_true", help="print the plan as JSON; no browser")
    args = ap.parse_args()

    plan = build_plan(args)
    if args.dry_run:
        print(json.dumps(plan, indent=2))
        return 0
    engine = backend()
    if engine is None:
        print(INSTALL_HINT, file=sys.stderr)
        return 2
    Path(plan["out"]).mkdir(parents=True, exist_ok=True)
    try:
        if engine == "python":
            capture_python(plan)
        else:
            subprocess.run(["node", "-e", NODE_RUNNER], input=json.dumps(plan), text=True, check=True)
    except Exception as e:  # unreachable URL, timeout, bad selector, browser not installed
        print(f"capture failed ({engine}): {e}", file=sys.stderr)
        return 3
    for s in plan["shots"]:
        print(f"{s['device']}\t{s['path']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
