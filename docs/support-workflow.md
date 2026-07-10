# Picom Support Workflow

Status: Hardened process baseline; trusted intake/backend still required  
Platforms: Windows, Linux and macOS Electron desktop  
Escalation policy: `docs/support/escalation-process.md`

## Goals

- Give every report one canonical, owned and privacy-safe lifecycle.
- Separate questions, defects, safety reports, privacy requests and active incidents.
- Collect the minimum evidence necessary to reproduce and resolve an issue.
- Keep users informed with a clear next update and safe workaround status.
- Close cases only after artifact/environment verification and documented outcome.

## Current product boundary

Picom can prepare, review, copy and export local redacted feedback/diagnostics. It does not automatically upload reports or logs to a support backend. This is intentional while provider, retention, consent and redaction controls are incomplete.

Relevant user-facing and operational documents:

- `docs/feedback-and-diagnostics.md`: local feedback and diagnostic export behavior.
- `docs/diagnostics-export.md`: diagnostic bundle boundaries.
- `docs/beta-feedback-triage.md`: beta categories and severity.
- `docs/support/escalation-process.md`: P0-P4 escalation and response templates.
- `docs/incident-response.md`: active incident command and technical runbooks.
- `docs/postmortem-template.md`: blameless incident review.
- `docs/beta-release-notes.md` and known-issues documents: tester guidance and published limitations.

The current `diagnostics:smoke` redaction failure is a release blocker. Until it passes and manual synthetic-secret review succeeds, support must not enable automatic diagnostic upload or treat copied exports as safe without user/support review.

## Case state model

Every case uses one of these states:

1. `new`: received, not yet redacted/classified.
2. `needs_safe_details`: minimum non-sensitive evidence requested.
3. `triaged`: category, priority, platform/version and owner domain assigned.
4. `investigating`: reproduction/provider/release correlation in progress.
5. `waiting_for_user`: a bounded safe question or retest is pending.
6. `waiting_for_engineering`: canonical engineering issue owns technical action.
7. `incident_linked`: managed by incident command; case receives approved updates.
8. `fix_ready`: exact build/config/mitigation is ready for verification.
9. `monitoring`: verified locally/staging; observing release/user outcome.
10. `closed`: resolved, duplicate, known limitation, cannot reproduce or declined with rationale.

P0 security/privacy/data-loss cases may move directly from `new` to `incident_linked`; do not delay escalation to fill every field.

## 1. Intake

### Required minimum

- User-facing summary and affected capability.
- Windows/Linux/macOS and OS version.
- Picom version and release channel.
- Approximate occurrence time with timezone.
- Expected and actual outcome.
- Safe reproduction steps and frequency.
- Whether the issue is ongoing and whether a safe workaround exists.

### Intake actions

1. Generate one case ID and timestamp.
2. Acknowledge receipt and provide the next update time.
3. Warn the reporter not to send passwords, codes, tokens, private content or `.env` files.
4. Restrict access immediately when privacy/security/abuse/data-loss is possible.
5. Remove duplicate uploads and keep one canonical evidence reference.
6. Route data export/deletion and moderation/appeal requests to their dedicated workflows.

Do not ask a user to reproduce a data leak, destructive action, suspicious attachment, account-takeover path or malicious deep link.

## 2. Redaction and evidence handling

Redact before the case enters normal search, chat, email or engineering systems.

Always remove or replace:

- passwords, passcodes, MFA/recovery codes and reset/verification values;
- access/session/refresh/JWT tokens, cookies and authorization headers;
- Supabase service-role/anon values, LiveKit credentials/tokens, bot/webhook/API keys, email/storage/signing/updater secrets and private keys;
- message/reply/draft/search content and private community/channel text unless the minimum exact evidence is legally/operationally approved in a restricted security case;
- attachment bytes, screenshots/recordings, signed URLs, invite links and local/object paths unless strictly necessary and access-restricted;
- email, username/display name, phone, raw user/community/channel/message/session/device identifiers when not required;
- raw IP, precise location, hostname, window title, process list, filesystem path, stack trace and request/provider body from normal ticket fields.

Use safe error code, request ID, redacted fingerprint, platform/version, bounded timestamp and operation class instead. Hashing an identifier does not automatically make it anonymous.

Evidence rules:

- Original sensitive evidence, when genuinely required, goes to a separately approved least-privilege store with retention/access audit; tickets contain a redacted reference.
- Support copies only the minimum necessary fields from local diagnostics.
- Never paste full database dumps, browser/local storage, `.env`, home folders or provider dashboards into a ticket.
- Never download/open suspicious quarantined files through normal support tools.
- Record who accessed restricted evidence and when according to the approved private process.

## 3. Triage

Within the priority target defined by the escalation process:

1. Validate completeness and redaction.
2. Assign category, P0-P4 priority, persona, platform, package format, version/channel and feature area.
3. Search known issues, duplicates, current incidents, release health and provider status.
4. Check recent desktop/backend/Edge Function/migration/config/feature-flag changes.
5. Reproduce with test accounts and non-sensitive data on the same supported platform/build.
6. Determine user impact, scope, workaround and release/security relevance.
7. Assign owner domain and next update time.
8. Link one canonical issue; duplicate cases remain separate for communication but do not duplicate evidence.

Triage outcomes:

- answer/how-to;
- known issue with safe workaround;
- product defect for engineering;
- trust-and-safety/moderation case;
- privacy/export/deletion request;
- security vulnerability report;
- active incident;
- feature request/product review;
- unsupported/out-of-scope request with explanation.

## 4. Diagnostics workflow

Use the in-app report only after the user has reviewed it:

1. Open Settings > Diagnostics.
2. Select the correct issue type and enter a content-minimized description.
3. Include logs/diagnostics only when necessary and explicitly selected.
4. Review the generated payload before copy/export.
5. Remove private content, credentials, raw identifiers, paths and irrelevant fields.
6. Transfer through the approved trusted channel and attach the case ID.
7. Support rechecks redaction before storing or escalating.

Preferred diagnostic fields:

- safe app/build/channel/platform/runtime metadata;
- mock/Supabase/realtime/LiveKit configuration status without values/secrets;
- safe current view and bounded operation class;
- safe error code/request ID/fingerprint and timestamp;
- recent redacted bounded logs only when explicitly included.

Diagnostics must never become required for a basic support response, privacy request or security disclosure.

## 5. Escalation

Use `docs/support/escalation-process.md` for priority and packet requirements.

Immediate incident/security escalation applies to:

- private-channel or cross-tenant access;
- credential/session/account takeover exposure;
- confirmed/suspected data loss or corruption;
- malicious/signed-package/update compromise;
- attachment scanner/quarantine bypass;
- broad startup/auth/message outage or SLO fast burn;
- production change requiring rollback, kill switch or provider escalation.

Normal engineering escalations include the canonical case, redacted reproduction, impact/scope, platform/version, safe timestamps/codes, recent-change correlation, workaround, requested decision and closure criteria. Support remains the user communication owner unless incident command assigns another.

## 6. User communication

- State confirmed user impact and current action; do not speculate about root cause or breach scope.
- Give a specific next update time even when there is no resolution.
- Explain workarounds with risk and reversal steps; never ask users to disable OS security globally.
- For incidents, use approved status communication and keep case replies consistent.
- For security/privacy, restrict details and coordinate wording with security/privacy/legal.
- Record every material user update in the case timeline.

Use the templates in `docs/support/escalation-process.md` and adapt only safe factual fields.

## 7. Fix verification

Before announcing resolution:

- identify the exact commit/config/migration/function/artifact and affected versions;
- test the original non-destructive reproduction on the same platform/environment;
- run relevant typecheck/build/smoke plus permission/security/regression checks;
- test one comparison platform when the defect may be cross-platform;
- verify workaround removal/reversal;
- confirm release notes/known issues/status and rollback guidance are accurate;
- monitor the release ring or provider outcome for the defined period.

A structural smoke or documentation update alone is not proof that a hosted/platform issue is resolved.

## 8. Closure

Allowed closure reasons:

- `resolved`: verified fix/mitigation and release reference recorded;
- `duplicate`: linked to an active canonical case and user remains subscribed to safe updates;
- `known_limitation`: documented, workaround/impact/owner and review date recorded;
- `cannot_reproduce`: safe attempts/environment recorded, next evidence request stated;
- `not_planned`: product rationale and alternative documented;
- `unsupported`: supported scope and safe next step explained.

Closure requires:

- redaction review and no unnecessary sensitive evidence in normal case fields;
- owner, outcome, exact verification and user-facing response;
- related known issue/release note/status change;
- retention/deletion classification for case evidence;
- P0/P1/repeated P2 post-incident actions with owners and dates;
- user confirmation when practical, or a documented monitoring window.

## Quality and review

Weekly during beta/stable rollout:

- review open P0-P2, stale `waiting` cases, duplicates and known issues;
- compare case categories with privacy-safe SLO/provider/release signals;
- audit a sample for redaction, owner, update timeliness and closure evidence;
- update known issues and `docs/user-feedback-synthesis.md` without identifiable data;
- track corrective actions, not individual user behavior.

Monthly:

- review category/severity consistency, escalation misses, workaround quality and reopened cases;
- delete/aggregate evidence according to approved retention;
- exercise one support-to-incident handoff and one artifact/reproduction packet;
- review accessibility and security-reporting access paths.

## Backend decision

No support backend was added. A production intake is not a trivial endpoint: it requires authentication/abuse controls, schema validation, consent, redaction, restricted evidence storage, retention/deletion, regional/legal handling, case authorization, audit and incident operations. It remains a separately reviewed V2 task.
