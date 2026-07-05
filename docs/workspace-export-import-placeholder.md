# Workspace Export / Import Placeholder

Status: post-MVP placeholder

Workspace export/import is planned as a future owner/admin tool for moving community configuration between Picom environments or creating reusable setup templates. This placeholder documents the safe boundaries without enabling runtime export/import.

## MVP stance

- Workspace export/import is not enabled in the current MVP runtime.
- Existing community/channel/message/member flows remain unchanged.
- No file import dialog or destructive config application is added yet.

## Exportable future configuration

A future export can include configuration only:

- community name and description placeholder
- categories
- channels
- private channel flags without member-private data
- roles
- permission templates
- notification defaults placeholder
- moderation settings placeholder
- rules
- custom emoji metadata placeholder

## Must not export

- messages
- member personal data beyond role mapping placeholders
- auth tokens
- session tokens
- invite secrets
- webhook tokens
- bot tokens
- audit logs
- private reports
- raw upload storage paths that bypass access checks

## Future import behavior

- Owner permission required.
- Show preview before applying.
- Validate schema version.
- Validate role/channel/category references.
- Reject unknown dangerous fields.
- Apply changes in a transaction or staged migration where supported.
- Never overwrite existing messages.

## Supabase/RLS expectations

- Export requires `manageCommunity` or owner-level permission.
- Import requires owner-level confirmation.
- Backend/Edge Function must be the authority for validating and applying imports.
- Frontend-only validation is not sufficient.

## File format placeholder

Potential export format:

```json
{
  "schemaVersion": 1,
  "app": "picom",
  "type": "workspace-config",
  "community": {},
  "categories": [],
  "channels": [],
  "roles": [],
  "permissions": []
}
```

## Rollback and recovery

- Import should create a pre-change snapshot before applying.
- If an import fails, partial changes should be rolled back.
- If rollback is unavailable, import must fail before applying changes.
- Audit logs should record safe metadata only.

## Feature flag behavior

A future `enableWorkspaceConfigImportExport` flag should hide entry points while disabled. Backend permissions remain mandatory.

## Implementation decision

This task is documentation-only. Runtime export/import services, UI, file dialogs, and Supabase functions are intentionally deferred.

## Manual verification

- Confirm no export/import UI appears in the MVP app.
- Confirm existing community/channel flow still works.
- Confirm this document excludes secrets and user message data.
