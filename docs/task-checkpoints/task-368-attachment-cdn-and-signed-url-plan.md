# Task 368 Checkpoint: Attachment CDN and Signed URL Plan

## Status

Completed as a documentation-only production delivery plan. No CDN integration, signed URL runtime code, upload service change, or storage migration was added.

## Changed files

- `docs/attachment-delivery.md`
- `scripts/attachment-delivery-smoke-test.mjs`
- `docs/task-checkpoints/task-368-attachment-cdn-and-signed-url-plan.md`
- `package.json`

## Commands run

```bash
npm run attachment-delivery:smoke
npm run typecheck
npm run qa:smoke
npm run build
```

## How to test manually

1. Open `docs/attachment-delivery.md`.
2. Confirm public/private attachment rules, signed URL placeholder, CDN cache behavior, thumbnail strategy, scanning, quarantine, and rollback are documented.
3. Confirm no real secrets, signed URLs, service-role keys, or provider credentials are included.
4. Run `npm run attachment-delivery:smoke`.

## Notes

Future signed URL generation must happen through server-side or policy-safe storage code. React components must not receive storage admin credentials.
