# Community Discovery Production Plan

Community Discovery is a post-MVP production capability for helping users find public Picom communities. It is intentionally not part of the current desktop chat MVP and must stay disabled until moderation, privacy, ranking, and abuse controls are ready.

## Current status

- Runtime feature: not implemented
- MVP status: excluded from first release
- Access model: future feature flag only
- Production readiness: not ready
- Desktop scope: Windows, Linux, and macOS desktop only

## Product goals

- Let users browse approved public communities.
- Help safe communities grow without relying only on invite links.
- Keep private or invite-only communities hidden.
- Provide abuse-resistant listing, search, and reporting foundations.
- Preserve Picom's premium desktop layout without adding mobile UI.

## MVP exclusions

Community Discovery must not block the MVP launch. The first MVP keeps only:

- community list
- create community
- switch community
- invite-based joining when available
- private community/channel boundaries

Not included in MVP:

- public marketplace
- algorithmic recommendations
- sponsored communities
- open public indexing
- mobile discovery layout
- public community ranking experiments

## Public community listing requirements

A community can appear in Discovery only when all future requirements are satisfied:

- owner explicitly opts in
- community has a public profile
- community has a safe name, description, icon, and category
- community has rules or moderation notes configured
- community passes automated and manual review placeholders
- community is not suspended, deleted, private, or invite-only
- owner account is not restricted

Suggested public profile fields:

```ts
export type PublicCommunityProfileDTO = {
  communityId: string;
  name: string;
  description: string;
  iconUrl?: string;
  bannerUrl?: string;
  category: string;
  memberCount: number;
  onlineCountPlaceholder?: number;
  language?: string;
  regionPlaceholder?: string;
  contentFlags?: string[];
  createdAt: string;
  listedAt: string;
};
```

Do not expose private channels, member lists, audit logs, invite secrets, owner email, or internal moderation metadata.

## Categories

Initial public categories can be simple and curated:

- Gaming
- Study
- Developers
- Design
- Music
- Workspaces
- Local communities
- Other

Categories should be normalized server-side and reviewed for abuse-prone naming.

## Search and ranking placeholder

Search and ranking should start conservative:

- exact and prefix match on public name/description
- category filtering
- language filter placeholder
- safe popularity signals such as public member count
- no private message content indexing
- no ranking based on sensitive user behavior

Future ranking must include anti-spam dampening for sudden joins, report spikes, and suspicious owner activity.

## Moderation requirements

Before beta exposure, Discovery needs:

- listing approval queue placeholder
- report community flow
- delist/suspend controls for app operators
- clear public content guidelines placeholder
- audit logs for listing changes
- abuse event logging for repeated spam attempts

Report community reasons:

- spam
- impersonation
- harassment
- illegal or unsafe content placeholder
- misleading listing
- other

## Join flow

Discovery join flow must stay distinct from invite links:

- Public join: user can request or join if community allows public membership.
- Invite join: user joins through a specific invite code with its own permissions, limits, and audit trail.
- Request access: owner/admin approval placeholder for restricted communities.

Private communities must never appear in public listing unless explicitly converted to public and approved.

## Anti-spam controls

Required before production:

- owner account age or trust threshold placeholder
- community listing rate limits
- public profile edit rate limits
- report rate limits
- join/request throttles
- duplicate listing detection
- unsafe keyword and URL validation
- manual delist controls

## Privacy concerns

Discovery must not reveal:

- private community existence
- private channel names
- private member identities
- user online status unless explicitly public and privacy-safe
- invite codes or webhook URLs
- message previews from private channels
- audit logs or moderation history

Public community cards should use aggregate counts only.

## Future frontend requirements

Future `DiscoveryView` should include:

- desktop-only search field
- category filters
- community cards
- join/request access button
- report community button
- empty state
- loading and error states
- feature-unavailable state if disabled by kill switch

The view must use Picom design tokens, Coolicons/AppIcon, and the existing desktop shell. It must not introduce mobile navigation.

## Future backend requirements

Potential Supabase-backed resources:

- `public_community_profiles`
- `community_listing_reviews`
- `community_reports`
- discovery search index placeholder
- RLS policies that expose only approved public profile fields
- Edge Function for protected report submission if needed

All access must be enforced server-side. Frontend feature flags are not security controls.

## Staging assumptions

- Use non-production Supabase project.
- Seed only safe test communities.
- Enable feature flag for internal testers only.
- Use fake or generated community names/icons.
- Validate that private communities are absent from search results.

## Beta assumptions

- Enable for small beta cohort only.
- Require manual approval for listed communities.
- Log reports and delist actions.
- Keep ranking simple and reversible.
- Treat abuse reports as release blockers if they reveal privacy leaks.

## Production assumptions

- Feature remains behind remote config/kill switch until moderation capacity exists.
- Public listing review workflow is staffed.
- Abuse rate limits are active.
- Reporting and delisting paths are tested.
- Privacy review confirms no private data leakage.

## Verification checklist

- Private communities do not appear in discovery.
- Private channels and messages are never indexed.
- Public DTO excludes secrets and internal metadata.
- Report community action records safe metadata only.
- RLS policies prevent unauthorized listing edits.
- Disabled feature flag hides or blocks all entry points cleanly.
- Desktop layout remains unchanged when the feature is disabled.

## Rollback plan

If discovery causes privacy, abuse, or stability issues:

1. Disable the `enableDiscovery` feature flag or kill switch.
2. Remove Discovery entry points from remote config.
3. Delist affected public profiles server-side if needed.
4. Keep evidence in audit/abuse logs without exposing private data.
5. Communicate that discovery is temporarily unavailable while normal invite/community chat remains operational.

## Known risks

- Public listing can attract spam communities.
- Ranking can amplify unsafe communities if not moderated.
- Poor RLS policies could leak private community data.
- Report workflows can expose private context if payloads are too broad.
- Discovery can distract from the MVP if implemented before core chat stability.

## Implementation TODOs

- Add `enableDiscovery` feature flag only when runtime work starts.
- Add public profile schema with strict RLS.
- Add moderation review queue before beta exposure.
- Add report community endpoint with rate limiting.
- Add desktop DiscoveryView only after MVP flows are stable.
