# Task 414 - Upload Cancel and Retry Behavior

## Status

Implemented.

## Scope

- Added local composer upload states:
  - `pending`
  - `uploading`
  - `uploaded`
  - `failed`
  - `canceled`
- Added upload progress placeholder UI on attachment previews.
- Added cancel behavior for in-flight uploads using `AbortController`.
- Added retry behavior for failed/canceled uploads.
- Kept remove behavior for pending/uploaded previews.
- Ensured message sending waits for successful attachment uploads.
- Added mock-mode upload delay so upload states are visible during local testing.

## Safety Notes

- Upload cancellation is best-effort for real Supabase Storage uploads because the SDK upload call does not currently receive a native abort signal here.
- The service checks the abort signal before and after the storage call and returns a safe canceled result when possible.
- Object URLs are revoked on remove, channel switch, unmount, and successful send.
- No mobile UI was added.
- No Electron titlebar/window behavior was changed.

## Manual Test

1. Start the app in mock mode.
2. Attach a PNG/JPG/WEBP/GIF image in the message composer.
3. Press Send and confirm the preview changes to Uploading, then Uploaded, then the message appears.
4. Attach another image, trigger upload, and press the preview cancel button while it is uploading.
5. Confirm the preview shows Canceled and can be retried.
6. Confirm failed/canceled previews do not send until retried or removed.
