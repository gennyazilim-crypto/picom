# Non-production validation

Validation target: `picom-community-creation-validation-20260831`
(`ighyekrjrxnlxyoyhhzj`). Its remote migration set matched production exactly:
306 applied versions and no version-set difference before validation.

The corrected function was first executed in a transaction that rolled back.
It compiled and exercised all six supported notification types, invalid type,
missing actor, self-recipient, invalid/missing resource, dedupe, and block
rejection paths.

The corrected forward migration was then applied through the official linked
Supabase migration path to that non-production validation project only. The
remote history recorded `20260905214245`.

Additional rollback-only database validations passed:

- authenticated-role recipient RLS for own select, claim, seen/read/dismiss;
- foreign select and mutation denial; trusted-insert execute revocation;
- friend-request received and accepted trigger producers;
- DM trigger delivery, muted-conversation suppression, and blocked-sender
  suppression;
- friend-presence transition producer;
- followed-user Live classifier.

No production query or mutation occurred in this validation sequence.
