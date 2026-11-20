---
name: gha-workflow-spec
description: >
  Writes the project's standard specification for a GitHub Actions workflow
  (.github/workflows/*.yml): triggers, job graph, inputs/outputs, secrets,
  constraints, failure handling, quality gates, saved as spec/spec-process-cicd-*.md.
  Use whenever the user asks for a spec, specification, or documentation of a
  workflow or CI/CD pipeline file, even if they don't say "spec".
argument-hint: "<path/to/workflow.yml>"
---

# GitHub Actions workflow specification

Target workflow: `$ARGUMENTS`. If empty, list `.github/workflows/*.yml` and ask which one.

The spec describes **what** the workflow guarantees, not how it's written: no YAML syntax, no action versions. Use tables and bullets.

## Workflow checklist

Copy this into your reply and tick items as you go:

```
- [ ] 1. Workflow and everything it calls are read
- [ ] 2. Facts extracted
- [ ] 3. Template filled
- [ ] 4. Verification passed
- [ ] 5. Saved
```

### 1. Read

Read the workflow file, plus every reusable workflow (`uses: ./.github/workflows/…`) and repo script it calls.

### 2. Extract

- Purpose: the business goal in one sentence
- Triggers, branch/path filters, target environments
- Jobs: purpose, `needs`, runner, conditions (`if:`), matrix
- Inputs (env, `workflow_call` / `workflow_dispatch` inputs), outputs, artifacts
- Every `secrets.*` and `vars.*` reference, and the `permissions:` granted
- Timeouts, concurrency, environments with approvals
- Failure paths: `continue-on-error`, `if: failure()`, retries, notifications

### 3. Fill the template

Use [templates/spec.md](templates/spec.md) as the **default structure**. Sections, in order: Overview, Execution Flow Diagram, Jobs & Dependencies, Requirements Matrix, Input/Output Contracts, Execution Constraints, Error Handling, Quality Gates, Monitoring, Integration Points, Compliance, Edge Cases, Validation Criteria, Change Management, Related Specifications.

- Leave out a section that doesn't apply rather than filling it with placeholders.
- Mermaid diagram: `graph TD`, one node per job. Parallel jobs branch from a common parent; conditional jobs use `{decision}` nodes. With 5+ jobs, group them into `subgraph` phases (Build / Test / Deploy).
- Fill `{OWNER}` from CODEOWNERS if present; otherwise ask.

### 4. Verify

Check each item. On a failure, go back to the step shown, then run the list again until every item passes:

- [ ] Every job in the YAML appears in the Jobs table and in the diagram → else step 2
- [ ] Every `secrets.*` / `vars.*` reference appears in Secrets & Variables → else step 2
- [ ] Every trigger and filter appears under Inputs → else step 2
- [ ] No YAML snippets, action versions, or tool commands in the spec → else step 3

### 5. Save

Save to `spec/spec-process-cicd-<workflow-file-name>.md` and show the user the path and a three-line summary.
