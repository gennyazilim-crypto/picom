# Picom Beta Feedback Intake

Picom beta feedback is collected manually through an approved support channel. The in-app flow prepares a structured report and never submits data automatically.

## Report categories

- `install_package`
- `startup_crash`
- `login_auth`
- `community_channel`
- `messaging`
- `upload`
- `mention_feed`
- `profile_page`
- `permissions_rls`
- `voice`
- `screen_share`
- `performance`
- `ui_layout`
- `accessibility`
- `security_privacy`
- `legal_policy`
- `other`

## Severity

| Severity | Definition | Initial response |
| --- | --- | --- |
| Blocker | Prevents installation, startup, login, or core messaging for most testers; includes credible private-data access leaks | Stop distribution and escalate immediately |
| Critical | Severe failure with no safe workaround or a high-impact security/privacy concern | Triage immediately and decide whether to pause the beta |
| Major | Important workflow is broken, but the beta remains usable with a workaround | Prioritize for the next beta patch |
| Minor | Limited defect with low user impact | Add to the normal beta backlog |
| Suggestion | Product or usability improvement rather than a defect | Review during backlog grooming |

Reporter-selected severity is an input. The triage owner assigns the final severity.

## Required report data

Every report must contain app version, release channel, desktop platform, data-source mode, Supabase environment, LiveKit environment, category, severity, a concise title and summary, reproduction steps, expected result, and actual result. A screenshot reference and redacted diagnostics/logs are optional.

The app fills version, release channel, runtime, platform, data-source mode, and safe service environment fields from `diagnosticsService`.

## Reporter workflow

1. Open **Settings > Advanced > Beta support** or the application menu feedback action.
2. Select the closest category and severity.
3. Complete the required reproduction fields without including private message content.
4. Optionally include redacted diagnostics and recent redacted logs.
5. Select **Copy redacted report**.
6. Send the copied JSON through the approved beta support channel and attach screenshots separately when appropriate.

No production support platform or automatic upload is part of the beta MVP.

## Triage workflow

1. Acknowledge receipt and assign a report ID.
2. Verify that the report contains no secrets or unnecessary personal content.
3. Reproduce on the reported platform and release channel.
4. Confirm category, severity, affected versions, and environment.
5. Search for duplicates and link related reports.
6. Set an owner and one status: `new`, `needs_info`, `confirmed`, `in_progress`, `ready_for_verification`, `resolved`, `deferred`, or `closed`.
7. Add confirmed user-visible defects to `docs/beta-known-issues.md` when a workaround or broad warning is needed.
8. Block or pause distribution for blocker issues until verification passes.

## Privacy and secret exclusions

Never request, copy, attach, or store passwords, password hashes, session tokens, Supabase service-role keys, LiveKit secrets, authorization headers, cookies, private signing keys, or unnecessary private message content. Diagnostics pass through `loggingService` redaction, but operators must still inspect reports before sharing them.

## Release decision linkage

- Blocker and unresolved critical issues are release-gate inputs.
- A beta patch candidate must reference every blocker/critical issue it claims to fix.
- Verification must use the same platform and environment where practical.
- Security/privacy and private-channel isolation reports are escalated immediately.
