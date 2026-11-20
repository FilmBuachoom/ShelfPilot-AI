# <App> UAT checklist

Each row: **What** must be true, and **How** Claude verifies it (page, steps, the API read that
proves it). A pasted checklist overrides this file for one run; rows that match reuse the How.
After each run, add new Hows and traps here.

## 1. Must pass

<!-- Money, data, sign-in, email. `/test smoke` runs only this section. -->

| # | What | How |
|---|---|---|
| 1.1 | <e.g. A cash sale with change: the receipt shows Received and Change> | <page › steps; `GET /api/…` → `field`> |

## 2. New features

| # | What | How |
|---|---|---|
| 2.1 | | |

## 3. Quick looks

| # | What | How |
|---|---|---|
| 3.1 | | |

## Project traps

<!-- Things that fooled a past run in this app: rollovers, snapshots, settings that need a reload,
     "by design" behaviour that looks like a bug. -->

| Trap | Do |
|---|---|
| | |
