# Account Deletion Workflow Placeholder

Picom prepares account deletion as a safe request workflow. The MVP does not hard-delete account data from the renderer and does not attempt destructive Supabase admin operations from the desktop app.

## Current behavior

- Settings > Account includes a Danger Zone.
- The user must type an exact confirmation phrase before creating a local deletion request placeholder.
- The request can be canceled locally.
- No messages, communities, profiles, sessions, or storage objects are deleted by this placeholder.

## Future production requirements

- Account deletion must run through a trusted backend or Supabase Edge Function with admin authorization.
- Owned communities must be transferred, archived, or explicitly handled before deletion.
- Sessions should be revoked after a real deletion request is accepted.
- Audit/account activity should record deletion request and confirmation events without storing secrets.
- User data should be anonymized or soft-deleted according to the privacy/data retention policy.

## Manual verification

1. Open Settings > Account.
2. Scroll to Danger Zone.
3. Confirm the delete button is disabled until the exact confirmation text is typed.
4. Type the exact phrase and click Request deletion placeholder.
5. Confirm no data disappears and the local status message updates.
6. Click Cancel deletion placeholder to clear the local request.