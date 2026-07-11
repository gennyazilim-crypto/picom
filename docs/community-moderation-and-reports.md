# Community moderation and reports

## Member actions

Community Admin and Moderator panels provide member search plus confirmed timeout, kick, and ban actions. Targets are evaluated against all assigned roles. Owners are protected and an actor cannot moderate themselves or an equal/higher role.

Active timeouts and bans are loaded through a permission-checked service. Authorized managers can remove a timeout or ban with a new reason. All actions are written to the moderation action ledger and append-only community audit log.

## Report lifecycle

Community reports move only from `open` to `reviewed`, `dismissed`, or `action_taken`, and from `reviewed` to `dismissed` or `action_taken`. Every transition requires a review reason and server permission.

Source links route Text message reports to an authorized channel/message, Radio reports to the station, Podcast episode/comment reports to the Podcast workspace, and user reports to a visible profile. Direct-message reports never enter the community queue; they remain restricted to authorized Picom Safety review. The queue contains only the selected evidence excerpt and does not fetch unrelated private content.

## Enforcement

- UI affordances use the canonical multi-role hierarchy helper.
- Supabase RPCs repeat owner, hierarchy, permission, transition, and private-scope checks.
- Report and member actions include actor, target, reason, and timestamp audit evidence.
- Radio and Podcast comment/report services retain their type-specific RLS and audit contracts.

Hosted pgTAP/RLS execution requires an approved Supabase environment. Local smoke tests validate deterministic source and migration contracts without claiming hosted evidence.
