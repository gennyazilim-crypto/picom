# Picom Beta Triage Board

This is a local/manual board template for the beta phase. It contains no user secrets or raw private content.

## Status columns

| New | Needs info | Confirmed | In progress | Ready for verification | Resolved / deferred |
| --- | --- | --- | --- | --- | --- |
| Newly received and redaction checked | Reporter or environment details required | Reproduced and classified | Owner is implementing a fix | Fix is available in a named candidate | Verified, closed, or explicitly postponed |

## Issue record template

```text
ID:
Title:
Category:
Final severity:
Status:
Owner:
Affected version/channel:
Platform:
Data source mode:
Supabase environment:
LiveKit environment:
Duplicate of:
Reproduction result:
Workaround:
Target patch:
Verification evidence:
Known-issues entry:
```

## Operating rules

- Keep blocker and critical items at the top of each column.
- Do not paste tokens, credentials, authorization headers, or raw private conversations into the board.
- Link to a securely stored redacted report rather than duplicating diagnostic payloads.
- One owner is accountable for each confirmed issue.
- Closing a blocker requires independent verification against a named build artifact.
- Deferred issues must include user impact, rationale, and a target planning phase.

## Current intake

| ID | Title | Category | Severity | Status | Owner | Target |
| --- | --- | --- | --- | --- | --- | --- |
| None | No reports recorded in this repository | Other | - | New | Unassigned | - |
