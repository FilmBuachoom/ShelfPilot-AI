# Set the issue's Priority field

Priority is a **data field on the issue**, not text in the body. Organizations define it once as an issue field (single select: `Urgent`, `High`, `Medium`, `Low`), and every repo in the org inherits it. It shows in the issue sidebar, in search (`priority:High`), and as a column on any project board.

Issue fields are a preview API, so every call sends the `GraphQL-Features` header below.

```bash
FEATURES='GraphQL-Features: issue_fields, repo_issue_fields, update_issue_suggestions'

# 1. Priority field ID and option IDs (once per run, in step 1)
gh api graphql -H "$FEATURES" -f owner=<owner> -f repo=<repo> -f query='
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      issueFields(first: 50) { nodes { ... on IssueFieldSingleSelect { id name options { id name } } } }
    }
  }' -q '.data.repository.issueFields.nodes[] | select(.name // "" | ascii_downcase == "priority")'

# 2. The new issue's node ID (from the URL gh issue create printed)
ISSUE_ID=$(gh issue view <issue_url> --json id -q '.id')

# 3. Set the value
gh api graphql -H "$FEATURES" -f issueId="$ISSUE_ID" -f fieldId=<priority_field_id> -f optionId=<option_id> -f query='
  mutation($issueId: ID!, $fieldId: ID!, $optionId: ID!) {
    setIssueFieldValue(input: { issueId: $issueId, issueFields: [{ fieldId: $fieldId, singleSelectOptionId: $optionId }] }) {
      issue { url }
    }
  }'
```

| Situation | Do |
|---|---|
| Step 1 returns the field | Use it. Don't also set a project Priority field |
| Step 1 returns nothing (personal repo, or the org has no Priority field) | Fall back to the project's **Priority** field in `reference/project-linking.md`. Say so in the preview |
| Neither exists | Leave Priority unset and report it. Never write it into the body instead |
| Option name differs | Match case-insensitively (`High` = `P1 - High` if that's the only "high" option); otherwise show the options and ask |
| Step 3 fails | The issue already exists. Report its URL and the error, and offer to retry only this step |

Never create fields or options. An org owner adds them under Organization settings → Issues → Fields.
