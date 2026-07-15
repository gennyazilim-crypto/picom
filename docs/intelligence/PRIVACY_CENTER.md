# Picom Intelligence Engine — Privacy Center

**Task 08 · user-facing data control surface.** One place to **review, export, and delete**
personal data and to **manage every optional consent** (analytics, personalization, AI
assistant, recommendations). Grounds on `termsAcceptanceService` (consent record pattern),
`analyticsService.setEnabled`, `analyticsQueue.clear`, `profilePrivacyService`, and the
diagnostics export.

## Location & principles
- Surfaced in **Settings → Privacy** (a dedicated section). Discoverable, plain-language,
  no dark patterns.
- **Symmetric control**: turning a consent off is exactly as easy as on, takes effect
  immediately, and purges the corresponding local data.
- **Truthful state**: shows what is actually collected right now, not aspirational copy.

## 1. Consent management
Independent switches, default **OFF**, each with a one-line "what this enables / what it
never touches":

| Toggle | Enables | Never uses |
|---|---|---|
| Product analytics | count/bucket usage metrics | message content, identity |
| Personalization | tailored ordering, favorites | private messages, DM graph |
| AI assistant | summaries, recaps, digest | training on your messages/audio/video |
| Recommendations | tailored suggestions | content, contact books |

Each change writes a **record of consent** `{tier, version, granted, timestamp}` (extending
the `termsAcceptanceService` pattern) and immediately toggles the corresponding engine.
Turning analytics off calls `analyticsService.setEnabled(false)` + `analyticsQueue.clear()`.

## 2. Review my data
A readable summary of every category held:
- Optional analytics: the device's own `getPrivacyDashboardSnapshot` (counts only).
- Personalization profile: locale/theme, favorite communities/emojis, active-hours
  histogram, feature weights (the on-device profile, human-readable).
- Consent history: tiers, versions, timestamps.
- Account/profile data and privacy settings (`profilePrivacyService`).
- Explicit statement of what is **never** collected (content, audio, video, raw IP,
  location) linking [DATA_COLLECTION_POLICY.md](./DATA_COLLECTION_POLICY.md).

## 3. Export my data (portability)
- **On-device export**: a redacted JSON bundle (consent history, analytics snapshot,
  personalization profile, settings) via the existing safe file-save + diagnostics
  redaction — no secrets, no content.
- **Account export** (server-side, GDPR/KVKK data portability): a job produces the user's
  own account data (profile, memberships, their own messages *as their own content export*,
  not analytics) in a portable format, delivered securely. Messages are exported to the
  **owner** as their data — never used for profiling.

## 4. Delete my data (erasure)
- **Delete optional data now** (local): clears analytics queue, personalization profile,
  and pending intelligence state — instant, no server round-trip.
- **Account deletion / server erasure**: triggers the existing account-deletion workflow
  (`account-deletion` / `account-deletion-finalize` Edge Functions) → cascades per
  [DATA_RETENTION.md](./DATA_RETENTION.md) (Task 09), with confirmation and a grace window.
- **Withdraw consent** = stop future collection **and** purge already-collected optional
  data for that tier.

## 5. Transparency extras
- Link to the privacy notice and this policy set.
- "Why am I seeing this?" explanations from Recommendations (Task 04).
- Kill-switch status (if the operator has disabled an optional feature).

## Guarantees
- No action here can expose another user's data; all operations are scoped to the
  authenticated user.
- Destructive actions (delete/erase) require explicit confirmation and are logged.
- Fulfills GDPR/KVKK rights: **access, portability, rectification, erasure, objection,
  withdraw consent**. Audited in Task 10.
