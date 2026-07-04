# Task 192 - In-app notification/toast system

## Scope

- Added a reusable `ToastStack` renderer for in-app notifications.
- Kept the existing overlay state hook as the source of truth for toast messages.
- Preserved the current Picom desktop shell and existing MVP chat interactions.

## Implementation notes

- Toasts are still pushed through `pushToast(message, tone)`.
- Toasts now use collision-resistant string IDs.
- Toast rendering is centralized so auth/startup and main app states share the same UI.
- Toasts include an accessible live region and a manual dismiss button.

## Manual verification

- Trigger a success toast by creating a community or channel.
- Trigger an info toast from a placeholder action.
- Trigger an error toast by forcing a recoverable API/mock failure.
- Confirm the toast appears in the bottom-right corner and can be dismissed.
