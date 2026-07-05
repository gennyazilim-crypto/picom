# Task 413: MemberSidebar virtualization

## Scope
- Prepared MemberSidebar virtualization architecture without changing runtime rendering.
- Preserved fixed desktop columns, member search, profile actions, and context menus.

## Completed
- Documented current MemberSidebar behavior and performance-friendly pieces.
- Documented why full virtualization is deferred.
- Defined a future virtual row model for group headers and member rows.
- Added manual QA criteria for large member lists and presence updates.

## Verification
- Run `Test-Path docs/member-sidebar-virtualization.md`.
- Run `npm run typecheck`.

## Manual test steps
1. Open the app and confirm MemberSidebar renders Admins, Moderators, Participants, and Offline.
2. Search members locally.
3. Open a member profile.
4. Right-click a member row.
5. Toggle MemberSidebar from ChatHeader and confirm ChatMain remains stable.

## Notes
- Runtime virtualization is intentionally deferred because row lifetime affects profile popovers, context menus, grouped headers, search, and presence updates.
