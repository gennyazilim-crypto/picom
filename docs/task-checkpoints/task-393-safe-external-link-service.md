# Task 393: Safe External Link Service

## Scope

Created the canonical desktop external link service and routed message links through it while preserving the existing compatibility import path.

## Changed files

- `src/services/desktop/externalLinkService.ts`
- `src/services/externalLinkService.ts`
- `src/components/MessageItem.tsx`
- `src/components/MessageList.tsx`
- `src/components/ChatMain.tsx`
- `src/styles.css`
- `docs/external-links.md`
- `scripts/external-link-service-smoke-test.mjs`
- `docs/task-checkpoints/task-393-safe-external-link-service.md`
- `package.json`

## Implementation notes

- Only `http:` and `https:` URLs normalize as safe external links.
- `picom://` and `myapp://` links are blocked by this service and reserved for `deepLinkService`.
- Message text now renders safe external URLs as inline link buttons.
- Link open failures surface a friendly toast through the existing `pushToast` path.
- Raw `window.open` remains only inside the centralized browser fallback service.

## Verification commands

```bash
npm run external-links:smoke
npm run renderer:native:smoke
npm run typecheck
npm run build
```

## Manual test notes

1. Run the app in mock mode.
2. Send a message containing `https://example.com`.
3. Click the rendered inline URL and confirm it opens externally.
4. Send text containing `javascript:alert(1)` or `file:///C:/Windows/System32/calc.exe`; it should not open as a safe link.
5. Use Settings > Advanced > Open system status to confirm help/status links still use the same service.

## Remaining risks

- No external-domain confirmation modal yet; `confirmExternalUrlPlaceholder()` is intentionally prepared for that future step.
- No production domain allowlist until support/status/documentation URLs are finalized.
