# Quiet Hours and DND enforcement

Picom applies notification policy inside `notificationService`; React components and backend code do not decide native delivery independently.

## Precedence

1. Disabled notifications suppress desktop, inbox, and unread routing for new local events.
2. Global mute or tray `Do Not Disturb` suppresses desktop delivery for every category, including mentions, while preserving inbox routing.
3. Active Quiet Hours suppress desktop delivery according to `applyTo`. Mentions bypass Quiet Hours only when `allowMentions` is enabled.
4. Mentions-only and digest settings suppress normal desktop interruptions while retaining inbox state.
5. Muted communities/channels suppress normal activity. Mentions bypass a muted scope only when `allowMentionsFromMutedScopes` is enabled.
6. Focused active channels near the bottom do not generate redundant desktop or inbox activity.

Quiet Hours use the desktop system timezone and support overnight ranges such as 22:00-07:00. The new muted-scope mention preference is migrated into settings schema version 4. Tray DND and scope mute identifiers are persisted by `notificationPolicyStateService`.

No backend path calls native notification APIs. The production inbox remains available during DND and Quiet Hours where the centralized route decision requires it.
