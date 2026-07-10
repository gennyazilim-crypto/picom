# Picom Age and Eligibility Gate Plan

Status: **Plan only - legal/product decision required before implementation**

Picom is a Windows, Linux, and macOS desktop community chat app with user-generated content, profiles, messages, attachments, voice rooms, and screen sharing. This document is an engineering/product plan, not legal advice. It does not select a minimum age and does not authorize collection of date of birth, identity documents, or parental information.

## Current decision

- Keep the current registration flow unchanged until target markets, distribution channels, audience, and legal basis are approved.
- Do not market Picom as a children's or Kids Category product.
- Do not infer age from profile text, messages, voice, device data, community membership, or third-party enrichment.
- Do not add a cosmetic frontend-only age checkbox. Eligibility must be server-enforced before account/profile creation and before personal data processing beyond what an approved flow permits.

## Decisions required before implementation

Legal, product, privacy, trust-and-safety, and operations owners must approve:

1. Launch countries/regions and governing entities.
2. Minimum age per market and whether Picom is general-audience, mixed-audience, or directed to children.
3. Whether self-declaration is sufficient or a proportionate age-assurance provider is required.
4. Whether under-threshold users are rejected or supported through verifiable parental consent.
5. Which data is collected, its legal basis, retention, deletion, support access, and appeal/correction process.
6. Store age ratings and content descriptors for chat, UGC, voice, screen share, moderation, links, and attachments.
7. How policy-version changes trigger renewed eligibility/guardian consent.

## Regulatory planning inputs

- United States: the FTC explains that COPPA concerns online services directed to children under 13, and general-audience services with actual knowledge, and generally requires verifiable parental consent before collecting personal information from covered children. See [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).
- European Economic Area: GDPR Article 8 sets 16 as the default threshold for a child's consent to information-society services when consent is the legal basis, while member-state law may provide a lower age not below 13. Country-specific counsel and legal-basis analysis are required. See [GDPR text on EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679).
- Other markets may impose different child-safety, privacy, identity-assurance, consumer, and content rules. A jurisdiction matrix is a launch blocker, not a post-launch task.

These inputs do not determine Picom's final minimum age.

## Product options for legal review

### Option A: Approved minimum-age hard gate

- Ask a neutral eligibility question before account creation.
- Reject ineligible users without creating Auth, profile, analytics, messaging, or community records.
- Store only the minimum evidence approved by counsel, preferably eligibility result, policy version, method, and server timestamp rather than full birth date.

### Option B: Region-aware threshold

- Resolve an approved country/region basis without silently using precise location.
- Apply the approved threshold and policy version for that region.
- Provide a correction/support path for the wrong region.
- Do not rely only on device locale, IP-derived country, or client clock.

### Option C: Guardian-consent flow

- Defer unless Picom intentionally supports under-threshold users and has legal, privacy, security, support, revocation, deletion, and verification operations ready.
- Separate child and guardian data; never ask a child to upload identity documents directly to Picom without an approved provider/design.
- Block chat, UGC, voice, screen share, discovery, notifications, and profile exposure until consent is valid.

## Proposed server model (not approved for migration)

Only after legal approval, consider an append-only evidence table with:

- `user_id` or pre-account transaction identifier
- `eligibility_policy_version`
- `market_code` or decision basis, if approved
- `result`: eligible, guardian_required, denied, review_required
- `method`: self_declaration or approved provider reference
- `recorded_at` server timestamp
- `superseded_at` and reason for corrections

Do not store full date of birth, identity document images/numbers, raw provider payloads, precise location, or raw IP by default. Never store passwords, tokens, messages, or voice/screen-share content in eligibility evidence.

## Future registration behavior

1. Show legal-approved, localized eligibility copy before collecting account credentials.
2. Open Terms/Privacy and age-specific notices from the same desktop flow.
3. Send the eligibility decision to a protected backend RPC; do not trust a renderer flag.
4. Create Auth/profile records only when the backend confirms eligibility or an approved guardian path permits it.
5. Record immutable version/timestamp evidence and return a generic outcome.
6. For denied users, avoid revealing verification internals; provide approved support/correction guidance.
7. Existing users receive a versioned re-check only when legal/product owners approve migration rules.

## Platform and distribution requirements

### Microsoft Store / Windows

Microsoft Store submission requires an age rating, and the current policies include UGC, child-safety, reporting, content, and higher-rated-content controls. Complete the IARC questionnaire from actual Picom functionality and re-evaluate after material feature changes. See [Microsoft Store Policies](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies).

### Apple App Store / macOS

App Store Connect requires accurate age-rating answers. Kids Category selection introduces additional privacy, parental-gate, advertising, and design constraints and should not be selected unless Picom intentionally targets that audience and passes legal/product review. See [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) and [Apple age-rating guidance](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating).

### Linux and direct distribution

AppImage, deb, rpm, Flatpak, Snap, repository, and direct-download channels may have different metadata and policy processes. The absence of a centralized store review does not remove legal, privacy, child-safety, or age-rating obligations. Verify each selected distributor at release time.

## Safety and abuse requirements

- Age gating does not replace reporting, blocking, moderation, private-channel controls, attachment scanning, abuse logging, or incident response.
- Prevent age value changes from becoming a bypass; corrections require a protected, audited support flow.
- Rate-limit eligibility attempts and provider calls without retaining excessive identifiers.
- Do not expose a user's age or eligibility status to communities, members, feeds, bots, webhooks, logs, or analytics.
- Include account deletion, consent withdrawal, guardian revocation, and backup retention in the approved lifecycle.

## QA matrix before launch

- Eligible, denied, guardian-required, review-required, and provider-unavailable outcomes.
- Windows, Linux, and macOS packaged builds.
- New registration, social login if later enabled, invite deep link, session restore, offline/retry, and clock manipulation.
- Region mismatch/correction and policy-version migration.
- No account/profile creation before backend approval.
- No private data in logs, diagnostics, crash reports, analytics, or support exports.
- Accessibility, keyboard navigation, English/Turkish copy length, and legal localization review.
- Store metadata/rating consistency with enabled features and remote kill switches.

## Release blockers

- No approved target-market/minimum-age matrix.
- No approved legal copy, privacy notice, retention, correction, and support workflow.
- No server-side enforcement and bypass tests.
- No platform age-rating submission review.
- No child-safety operational owner, escalation path, and incident process where required.

Until all blockers are cleared, Picom must not claim that an age/eligibility gate is implemented or legally compliant.
