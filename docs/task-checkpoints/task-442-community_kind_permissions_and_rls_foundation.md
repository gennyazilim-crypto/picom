# Task 442 Checkpoint: Community Kind Permissions and RLS Foundation

## Result

- Added a canonical frontend capability matrix for Text, Radio, and Podcast communities.
- Added type-aware service guards and corrected mock audio sources to use dedicated Radio/Podcast communities.
- Added database kind constraints, relation-scope triggers, role capability backfill, and type-specific RLS policies.
- Added a 30-assertion Owner/Admin/Moderator/Member/Visitor pgTAP matrix and deterministic contract smoke.

## Security boundaries

- Cross-kind source writes fail with a check violation.
- Visitors cannot create listener/reaction/comment state and cannot read private Podcast metadata.
- Podcast draft, publish, edit, and archive actions use separate capabilities.
- Private audio files remain behind existing storage policies, now backed by kind-aware visibility helpers.

## Validation plan

- `npm run community:kind-permissions:smoke`
- `npm run community:kind:smoke`
- `npm run audio:schema:smoke`
- `npm run audio:service:smoke`
- `npm run audio:mvp:qa`
- `npm run supabase:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

Real pgTAP execution requires an isolated Supabase CLI database. If the CLI is unavailable, that check remains BLOCKED rather than reported as passed.
