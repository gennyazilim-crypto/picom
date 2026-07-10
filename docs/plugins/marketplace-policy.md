# Plugin marketplace and developer policy

## Status: not approved

Picom has no public marketplace, sideloading, plugin installer/runtime, developer terms or production trust root. This policy is a draft gate only and does not authorize arbitrary code execution, dynamic loading or publishing.

## Eligible extension model

Prefer backend bots/webhooks and declarative host-rendered manifests. Marketplace submissions contain deterministic manifest, publisher/application ID, immutable version/hash, Picom compatibility, declared data flows/domains, licenses/notices, support/privacy/security contacts and deny-by-default capabilities. Remote/self-modifying code, hidden downloads or unreviewed native dependencies are forbidden.

## Review and signing

- verified publisher and ownership/recovery/MFA; no anonymous credential issuance;
- automated schema/dependency/license/secret/malware/prohibited-capability/reproducibility checks;
- manual security/privacy/accessibility/UI/moderation/data-flow review for every first release and permission expansion;
- version-specific Picom signature/provenance after review; signing proves integrity, not safety;
- immutable packages, compatibility/downgrade tests, transparent permission diff and user/admin re-consent;
- independent sandbox review before any local executable experiment.

## Permissions

No wildcard. Effective access is intersection of application review, install approval, current user/community/channel backend permission and resource visibility. Examples: command metadata, community/channel metadata, visible-message ID recheck, backend bot send/reaction and bounded host-rendered status UI. Every call is schema/rate/audit/revocation checked server-side where data/actions are involved.

## Forbidden capabilities

No shell/process/filesystem/registry/keychain/environment/native module, raw Electron/preload/IPC, direct database/service-role, token/cookie/password, arbitrary network/private host, microphone/camera/screen/clipboard capture, auth/update/payment/security UI, unsafe HTML/CSS/script, hidden background work, cryptomining, surveillance, impersonation, ads/dark patterns, remote code, `eval`/dynamic import or security-control bypass.

## Listing and user protection

Listings clearly show publisher, version, reviewed permissions/data, pricing only after billing approval, privacy/support terms, compatibility, update history and report button. Installation requires authorized owner/admin and explicit permission display. Private channels are excluded unless separately visible/approved and backend-enforced. Removal does not delete user/community data without explicit reviewed action.

## Enforcement, revocation and appeals

Picom may reject, quarantine, delist, disable version/publisher, revoke credentials/signatures and notify affected admins for malware, compromise, policy breach or unsafe behavior. Emergency kill switch works offline/at startup where feasible; Safe Mode disables extensions. Preserve minimal audited evidence without secrets/private content. Publisher appeal/re-review process, deadlines and public disclosure require Legal/Trust & Safety approval.

## Developer terms placeholders

Identity/authority, license/IP/third-party compliance, privacy/security/data processing, prohibited conduct, vulnerability reporting, support/SLA, moderation/cooperation, fees/tax (if ever approved), suspension/termination, warranties/liability, audit/evidence, jurisdiction/change notice and deletion/export obligations require counsel. No terms are accepted or published by this draft.

## Launch gate

Scope lock; declarative/sandbox threat model; developer backend/credential/scopes; review staff/tooling/SLA; signing key custody/transparency/revocation; cross-platform sandbox pentest; privacy/legal/developer terms; report/appeal/support/incident; staged internal pilot and go/no-go. Until complete, marketplace and plugin runtime remain hidden/disabled.
