# Community Rules and Welcome Screening Foundation

Picom's community rules and welcome screening feature is currently a local foundation. It prepares typed rules and local acceptance state without forcing a new blocking modal into the current desktop MVP flow.

## Current behavior

- `communityRulesService` exposes default local rules for a community.
- Rules acceptance can be recorded locally per community and user.
- Acceptance state is stored in browser/Electron local storage under a versioned key.
- Corrupted local acceptance data resets safely and logs a redacted warning.
- No backend routes or RLS policies are added yet.

## Current files

- `src/types/communityRules.ts`
- `src/services/communityRulesService.ts`

## Future UI

Future desktop UI can use this service to power:

- Community Settings > Rules.
- Welcome Screening modal.
- Limited welcome view until required rules are accepted.
- Owner/admin rule editing.

## Future Supabase requirements

- `community_rules` table with `community_id`, `title`, `body`, `position`, `required`, timestamps.
- Member field such as `rules_accepted_at`.
- RLS policies for member read access.
- Owner/admin permissions for editing rules.
- Route or RPC for accepting rules atomically.

## Safety notes

- Do not block existing MVP community switching until the welcome-screening UI is intentionally introduced.
- Do not store secrets, tokens, passwords, or private keys in rules text.
- Backend permissions must enforce rule editing; frontend visibility is not security.

## Manual future test

1. Create or open a community.
2. Open Community Settings > Rules.
3. Add or edit rules as owner/admin.
4. Join through invite as a new member.
5. Confirm Welcome Screening appears.
6. Accept required rules.
7. Confirm the member reaches the full desktop chat view.
