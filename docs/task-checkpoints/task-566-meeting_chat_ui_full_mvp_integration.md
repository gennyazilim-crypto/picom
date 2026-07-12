# Task 566 checkpoint: meeting chat UI Full MVP

## Delivered

- Completed the narrow desktop right-dock chat on top of Picom's canonical message, reaction, report, attachment, read-state, and realtime services.
- Added persistent replies, edit/delete with version checks, emoji reactions, reports, image uploads/previews, safe HTTP(S) links, and exact meeting/message deep links.
- Added source context, preservation policy, guest/read-only messaging, realtime state, and role-aware controls.
- Added private attachment metadata loading through RLS plus short-lived signed display URLs.
- Kept community chat unchanged and introduced no independent meeting message store.

## Validation contract

Run the Task 539 backend smoke, Task 553 right-dock smoke, Task 566 UI smoke, typecheck, mock smoke, production build, renderer performance budget, and QA smoke before commit.

## External evidence

- Hosted Supabase member/guest/RLS, attachment, reaction, report, and post-meeting history validation: **BLOCKED**, authorized staging unavailable.
- Two-client realtime meeting-chat validation: **BLOCKED**, hosted test identities unavailable.
- Native image picker validation on Windows/Linux/macOS: **BLOCKED**, native matrix unavailable in this workspace.
