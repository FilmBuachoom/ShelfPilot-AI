# <Env> <type> test — <version>

| | |
|---|---|
| **Date** | <dates> (<timezone>) |
| **Build** | `<version>` — <tip of `<branch>` (`<sha>`) / N commits behind> |
| **Where** | <hosts tested> |
| **Accounts** | <test account (plan/role)>, <extra accounts> |
| **How** | Claude in <browser>; the tester signed in, Claude ran the checklist |

## Verdict

**<Go / Go with conditions / No-go>** — <one sentence why>.

<Which Highs are app and which are config. Then the exact rows the tester must check by hand
before deploying.>

## Bugs found

| # | Issue | Severity | Where |
|---|---|---|---|
| 1 | <what happens, how to see it> | High / Medium / Low (config) | <page or `file:line`> |

Not confirmed (may be the test browser): <items>.

## Checklist results

### 1. <Must pass>

| Item | Result | Notes |
|---|---|---|
| <row> | ✅ / ⚠️ partial / ❌ / ⬜ not done / ➖ stale | <evidence: id, API field, figure> |

### 2. <next section>

<same table>

## Stale checklist items

<rows whose feature moved or left the release, with the commit>

## Test data left on <env>

<every QA record, changed setting (old → new), open session or shift, extra account>

## Screenshots

- [<what> — <device>](screenshots/<file>.jpg)

<!-- Legend: ✅ pass · ⚠️ partial or environment-limited · ❌ fail · ⬜ not done (say why and who) ·
     ➖ stale / not in this release -->
