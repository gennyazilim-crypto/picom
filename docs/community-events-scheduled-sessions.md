# Community Events, RSVP, and Reminders

Picom community managers can create, edit, and cancel scheduled desktop events. Members can choose `interested`, `going`, or `not_going`; the backend keeps one RSVP per event/user and requires active community membership.

## Reminders and notification preferences

Reminders are opt-in per event and only available for interested or going users. Desktop scheduling passes through `notificationService`, so notification preferences, muted state, mentions-only mode, DND routing, quiet hours, and native permission remain authoritative. Cancelled events clear local timers. Production delivery can later use a trusted scheduled worker that reads only enabled reminder records and re-checks membership and preferences.

## Access and privacy

Event reads use existing community visibility rules. Management updates require owner/admin access through RLS. RSVP details are self-readable; other users receive no RSVP identity list from this feature. Audit/logging must not include private descriptions, tokens, or session values.

## Calendar boundary

No external calendar integration, OAuth grant, calendar write, ICS publishing, or third-party webhook is included. Future calendar sync requires explicit user approval, minimal scopes, revocation, provider review, and a separate security assessment.

## manual checklist

1. Create an event with valid local times, then edit its title/time.
2. Confirm invalid end-before-start input is rejected.
3. Set each RSVP state and confirm only one current state remains.
4. Enable a reminder for Going/Interested; confirm Not going disables it.
5. Confirm notification mute/mentions-only/quiet-hours suppress or silence delivery.
6. Cancel an event and confirm it leaves the active list and its timer is cleared.
7. Confirm a visitor cannot RSVP and a non-manager cannot edit/cancel.
