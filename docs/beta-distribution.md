# Picom Beta Distribution

Picom beta is a controlled Windows, Linux, and macOS desktop test. It is not a production release or public open beta.

Tester entry point and candidate lifecycle: [Beta distribution portal/process](beta-distribution-portal.md).

## Audience and channel

- Release channel: `beta`
- First ring: named internal engineering, QA, product, and support testers
- Second ring: small invited external group only after a formal `GO` or `GO WITH NON-BLOCKERS`
- Public downloads: prohibited until a separate approval

## Package delivery

The beta coordinator places immutable, versioned artifacts in `<INTERNAL_BETA_DOWNLOAD_LOCATION>/<version>/<platform>/`. Each folder should include the package, SHA-256 checksum, release notes, known issues, and installation guide.

Do not distribute electron-builder `.tmp` folders, `.env` files, source secrets, signing credentials, test passwords, or private diagnostics.

## Platform packages

- Windows: NSIS installer, `Picom-<version>-<channel>-Windows-<arch>.exe`
- Linux: AppImage and/or deb produced and tested on Linux
- macOS: dmg and/or zip produced and tested on macOS

Unsigned internal beta packages may trigger SmartScreen or Gatekeeper warnings. Testers must verify the approved source/checksum and must not disable operating-system security globally. See [Beta installation guide](beta-installation-guide.md).

## Accounts and staging services

Testers register with approved staging email addresses, accept the draft beta legal documents, and complete onboarding. They must not reuse production passwords.

The build may contain the public staging Supabase URL/anon key and public LiveKit `wss://` URL. Supabase service-role keys, access tokens, LiveKit API keys/secrets, and provider client secrets must never be distributed. Staging endpoints are supplied through the approved environment/build process, not this document.

## Required testing

Use [Beta test flows](beta-test-flows.md) for desktop shell, auth/onboarding, Mention Feed, Full Profile Page, communities, permissions, messaging, uploads, realtime, voice, screen share, diagnostics, and packaging.

## Reporting and diagnostics

1. Open Settings > Diagnostics.
2. Export redacted diagnostics/logs or use the Feedback modal to copy a structured report.
3. Inspect the export before sharing it.
4. Submit it through `<PICOM_BETA_ISSUE_TRACKER>` using [Beta feedback triage](beta-feedback-triage.md).

Picom does not automatically send feedback/logs in this MVP. Never attach passwords, tokens, authorization headers, secrets, or unrelated private content.

## Rollback and reinstall

1. Stop distribution and withdraw the affected artifact without replacing it under the same version/checksum.
2. Export redacted diagnostics before resetting local state when safe.
3. Quit Picom fully, uninstall the affected build, and revoke sessions if security requires it.
4. Reinstall the last approved artifact only after client/server compatibility is confirmed.
5. Re-run launch, login, migration/session, chat, and staging connectivity smoke tests.

## Known issues and exclusions

- [Known issues](known-issues.md)
- [Beta release notes](beta-release-notes.md)
- [Beta Go / No-Go](beta-go-no-go.md)
- [Detailed distribution plan](beta-distribution-plan.md)
- [Beta distribution portal/process](beta-distribution-portal.md)

Do not test or expect mobile apps, bot marketplace, production webhooks, plugin runtime, enterprise SSO/SCIM, billing, production auto-update, production E2EE, or public discovery marketplace.
