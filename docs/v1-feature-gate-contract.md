# Picom V1 Feature Gate Contract

## Authority

`src/config/v1ReleaseScope.ts` is the single typed V1 release-scope authority. Navigation, community selection, onboarding, Settings sections, Help topics, search results, badges, deep links, build metadata, and release documentation must consume or be contract-checked against it.

Frontend gating is a release-surface control, not an authorization boundary. Supabase RLS, Storage policies, Edge Function JWT validation, and service permissions remain mandatory.

## Enforcement

- Global navigation includes only registry entries whose feature is enabled.
- Community ServerRail includes only enabled community kinds.
- Voice channels are absent because Task 621 classified Voice Rooms and Screen Share `HIDDEN_FROM_V1`.
- Hidden settings and community-admin sections are not selectable.
- Hidden Help topics and quick filters are not rendered.
- Global search omits hidden categories.
- Badge derivation returns no hidden-feature badge.
- Renderer and notification deep links reject hidden destinations with a safe V1 message.
- Command navigation contains no hidden destination.
- Global audio surfaces and profile/feed audio modules remain unrendered in V1.
- Build metadata claims Windows as the only stable V1 platform.

## Safe blocked-route behavior

A blocked deep link or stale local navigation request must:

1. Avoid mounting the hidden workspace.
2. Avoid loading private hidden-feature data for presentation.
3. Return the user to Feed when a safe fallback is needed.
4. Explain that the destination is not included in Picom V1 Core.
5. Never imply that access can be bypassed with a URL.

## Retention rule

Do not delete Radio, Podcast, Events, Bookmarks, Meeting, Voice, Screen Share, bot, webhook, or other post-V1 source code and stored data solely because the surface is gated. The V1 gate prevents navigation and rendering; it is intentionally reversible after a future scope decision and evidence review.

## Task 621 final decision

Voice Rooms and Screen Share are `HIDDEN_FROM_V1`. Their source and stored data remain intact, but V1 navigation, onboarding, settings, channels, feed controls, help, deep links, Edge deployment and release copy must not expose them. A future release requires a new scoped decision plus real hosted and packaged-Windows evidence.

## Test contract

Run:

```powershell
node scripts/v1-core-scope-smoke.mjs
```

The check verifies classifications, Windows-only metadata, gate consumers, hidden command removal, release documentation, and clean-checkout logo dependencies. It does not replace typecheck, build, hosted security evidence, or manual Windows release testing.
