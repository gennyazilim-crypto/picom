# Task 186: Drafts sync across devices

## Decision

Cross-device draft sync remains disabled. Local channel/DM drafts are the privacy-safe default until consent, retention, encryption, membership recheck, and deletion semantics receive review.

## Completed

- Made the local-only remote-disabled policy explicit in the service.
- Preserved per-channel and per-DM keys and clear-on-send behavior.
- Added deterministic future conflict resolution without enabling network sync.
- Documented that secrets, tokens, files, object URLs, and native paths must never sync.

## Verification

- `npm run drafts:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
