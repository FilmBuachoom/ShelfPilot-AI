# Link an issue to a GitHub Project and set its fields

Skip this if the user chose "no project". Needs the `project` token scope.

Set **Status** here. Set the project's **Priority** field only when the repo has no Priority issue field (`reference/priority-field.md`, step 1 came back empty). With the issue field, the board shows it as a column already.

```bash
# 1. Project node ID (once per run)
PROJECT_ID=$(gh project view <number> --owner <owner> --format json -q '.id')

# 2. Field IDs and option IDs for Status (and Priority, fallback only) (once per run)
gh project field-list <number> --owner <owner> --format json \
  -q '.fields[] | select(.name=="Status" or .name=="Priority") | {name, id, options}'

# 3. Add the issue to the project → returns the item ID
ITEM_ID=$(gh project item-add <number> --owner <owner> --url <issue_url> --format json -q '.id')

# 4. Set Status (single-select field)
gh project item-edit --id "$ITEM_ID" --project-id "$PROJECT_ID" \
  --field-id <status_field_id> --single-select-option-id <backlog_or_todo_option_id>

# 5. Fallback only: set the project's Priority field
gh project item-edit --id "$ITEM_ID" --project-id "$PROJECT_ID" \
  --field-id <priority_field_id> --single-select-option-id <priority_option_id>
```

- Match option names case-insensitively (`High` = `high` = `P1 - High` if that is the only "high" option).
- If a field or option doesn't exist in the project, skip that field and report it. Never create fields or options on the project.
- If the issue was created but the link failed, report the issue URL and the error, and offer to retry only the link step.
