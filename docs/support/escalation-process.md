# Picom Support Escalation Process

Status: Operational process baseline  
Scope: Picom Electron desktop app on Windows, Linux, and macOS  
Related runbooks: `docs/beta-feedback-triage.md`, `docs/incident-response.md`, `docs/postmortem-template.md`

## Purpose

This process turns user reports into privacy-safe, reproducible, owned work. It separates individual support cases from active incidents, gives engineering a consistent escalation packet, and prevents sensitive content or credentials from being copied into tickets.

Response targets below are internal planning targets, not a contractual support SLA. Named responders and private contact channels must be assigned before stable launch.

## Intake channels

- In-app Feedback and Diagnostics export through an approved trusted support channel.
- Published support email/portal placeholder.
- Release/beta feedback channel controlled by support.
- Security vulnerability channel placeholder; security reports must not be posted publicly.
- Status page/incident intake for widespread service disruption.

Support must create one case reference and acknowledge the user without asking them to reproduce a security/privacy leak further.

## Bug categories

| Category | Examples | Default owner domain |
| --- | --- | --- |
| Install/update/uninstall | Signature, installer, package format, first launch, rollback | Release/Desktop |
| Startup/crash/performance | Blank screen, crash loop, safe mode, high memory/CPU, slow start | Desktop |
| Login/account | Register, login, session restore/revoke, password reset, profile | Auth |
| Community/channel/permissions | Join, role, private channel, RLS denial, ownership | Community/Security |
| Messaging/realtime | Send/edit/delete, duplicate/order, reconnect, unread/search | Messaging/Realtime |
| Upload/media | Validation, progress, quarantine, image preview, signed delivery | Storage/Security |
| Voice/screen share | Token, join, device, mute/deafen, permission, capture | Voice/Desktop |
| Notifications/tray/startup | Native notification, quiet hours, tray, launch on startup | Desktop |
| Safety/abuse | Report, block, moderation, harassment, suspicious upload | Trust and Safety |
| Privacy/security | Data exposure, private-channel access, credentials, account takeover | Security/Privacy |
| Accessibility/localization/UI | Keyboard/focus, screen reader, contrast, clipping, copy | Desktop/Product |
| Data export/deletion | Export scope, deletion status, retention, owned communities | Privacy/Backend |
| Feature request | New capability without a current defect | Product |

## Severity and escalation

| Support priority | Definition | Examples | Initial target | Escalation |
| --- | --- | --- | --- | --- |
| P0 | Suspected security/privacy breach, data loss, credential exposure, or broad service outage | Private-channel leak, malicious package, account takeover, destructive migration | Immediate; do not wait for full reproduction | Declare SEV0/SEV1 using incident response; notify security/incident commander and freeze affected rollout/path |
| P1 | Core stable flow broadly unavailable with no safe workaround | App will not start for a release ring, valid auth fails, message send fails broadly | Acknowledge within 30 minutes; engineering triage within 1 hour | Engineering lead plus operations; evaluate rollback/kill switch/status communication |
| P2 | Major feature broken or repeated crash with a safe workaround | Upload or voice outage while text chat works, platform-specific regression | Acknowledge within 4 business hours; triage same business day | Owning engineering team; incident escalation if scope grows or SLO burns |
| P3 | Localized defect with limited impact | UI clipping, isolated device issue, incorrect non-sensitive copy | Acknowledge within 1 business day | Product backlog with owner and target release when accepted |
| P4 | Question, suggestion, or cosmetic issue | How-to request, non-blocking polish, feature idea | Acknowledge within 2 business days | Support/product review; no engineering escalation required unless selected |

Any suspected unauthorized access, secret exposure, harmful attachment bypass, data corruption/loss, or signing/update compromise is P0 regardless of affected-user count. Do not downgrade because reproduction is incomplete.

## Triage workflow

1. **Acknowledge and protect:** create the case ID, confirm receipt, and tell the user not to send credentials/private content.
2. **Redact:** remove passwords, tokens, cookies, authorization headers, keys, signed URLs, raw IPs, private message bodies, unrelated screenshots, and local file paths before storage or sharing.
3. **Classify:** assign category, platform, release version/channel, data mode, priority, and suspected affected component.
4. **Check scope:** search known issues/duplicates, release health, provider status, and recent deploy/config/feature-flag changes.
5. **Reproduce safely:** use test accounts/data and the same supported platform/package. Never ask the reporter to repeat a suspected leak, destructive action, or malware download.
6. **Decide route:** answer/how-to, known issue, engineering defect, trust-and-safety case, privacy request, or active incident.
7. **Assign and time-box:** record owner, next update time, workaround, release impact, and evidence needed.
8. **Communicate:** use the templates below; state facts and impact without speculation or infrastructure secrets.
9. **Verify resolution:** retest the exact artifact/environment and original flow, plus a relevant regression path.
10. **Close or monitor:** document result, release/fix reference, user confirmation when available, and follow-up. Link duplicates to one canonical issue.

## Required diagnostics

Collect the minimum necessary:

- Case ID, category, priority, user-safe summary, expected/actual result, frequency, and first/last occurrence time with timezone.
- Picom version, release channel, Windows/Linux/macOS version, package format, and install/upgrade path.
- Mock/Supabase mode and whether LiveKit/realtime/upload was involved; never collect service credentials.
- Reproduction steps using non-sensitive test data.
- Safe error code, request ID, crash fingerprint, health/provider status, and bounded timestamps where available.
- Redacted diagnostics/log export only with explicit user selection/consent.
- For package issues: artifact filename, published checksum, signature/notarization result, and clean/upgrade machine context.

Optional screenshots must crop/blur community names, usernames, messages, emails, invite links, tokens, and local paths unless that exact data is necessary and approved for a restricted security case.

Do not request:

- passwords, MFA/recovery codes, auth/session/refresh tokens, cookies, authorization headers, API/service-role/LiveKit/signing keys;
- full database dumps, browser/localStorage exports, `.env` files, private keys, or entire home directories;
- unrelated private messages, attachments, member lists, contact lists, or raw voice/screen recordings;
- users to open suspicious files, disable security controls, or run unreviewed shell commands.

## Engineering escalation packet

Every P0–P2 engineering escalation must contain:

- Canonical case/incident ID, category, priority/severity, owner, next update deadline.
- User impact, affected platform/version/channel, estimated scope, start time, and whether impact continues.
- Redacted reproduction and expected/actual behavior.
- Safe error codes/request IDs/timestamps and links to restricted evidence, not copied secrets/content.
- Recent release/deploy/migration/config/feature-flag correlation.
- Workaround/mitigation attempted and result.
- Security/privacy/data-loss assessment and whether evidence preservation is required.
- Requested engineering decision: reproduce, mitigate, rollback, kill switch, hotfix, or clarify behavior.
- Verification/closure criteria.

Engineering acknowledges ownership in the canonical issue. Support remains the user-communication owner unless incident command assigns another communicator.

## Privacy and security handling

- Security/privacy cases use restricted access, least-privilege recipients, evidence retention rules, and an immutable incident timeline.
- Preserve original evidence in an approved restricted store; support tickets contain redacted references only.
- Do not confirm a breach, attribute cause, promise deletion, or publish affected scope before security/privacy/legal approval.
- Revoke sessions, rotate secrets, disable paths, or preserve logs only through authorized runbooks; support must not improvise production changes.
- Data-subject export/deletion requests follow the verified privacy workflow, not ordinary ticket attachments.
- Malware/suspicious attachment reports must not expose or download quarantined files through normal support tools.
- Notify the security owner immediately for private-channel leakage, cross-tenant access, secret exposure, account takeover, malicious deep links/native behavior, scanner bypass, or signed artifact compromise.

## Response templates

### Initial acknowledgement

> We received your Picom report as case **{caseId}**. We are reviewing it on **{platform/version}** and will update you by **{nextUpdate}**. Please do not send passwords, verification codes, tokens, private messages, or unrelated files.

### Need safe details

> To reproduce this safely, please share the Picom version, operating-system version, the steps you took, expected result, actual result, and approximate time with timezone. If you include Picom diagnostics, review the export first and remove any private content. We will never ask for your password or session token.

### Known issue/workaround

> This matches known issue **{issueId}** affecting **{scope}**. A safe workaround is **{workaround}**. We are tracking a fix for **{target/unknown}** and will update this case when a verified build is available.

### Incident acknowledgement

> We are investigating an active Picom service issue affecting **{user-visible capability}**. The team has paused relevant changes and is working on mitigation. Do not reinstall, retry destructive actions, or share credentials unless our published status guidance says otherwise. Next update: **{time}**.

### Security/privacy report

> Thank you for reporting this. We have restricted the case and escalated it to Picom security/privacy review. Please do not reproduce the behavior further or post details publicly. Do not send passwords, tokens, or additional private content; we will request only the minimum evidence through an approved channel.

### Resolved/retest

> Fix **{version/change}** is available for case **{caseId}**. We verified **{flow/platform}** and the related regression check. Please retry the original non-destructive steps and tell us whether the issue remains. If it does, include the new time and safe error code only.

### Closure

> We are closing case **{caseId}** as **{resolved/known limitation/duplicate/cannot reproduce}**. Resolution: **{short factual summary}**. No credentials or private content are retained in the support summary. Reply through the approved support channel if the same issue returns.

## Incident conversion criteria

Convert a support case to the incident process immediately when:

- multiple users/platforms report the same core failure or an SLO fast-burn alert fires;
- private data, cross-tenant access, credentials, data loss/corruption, malicious update/package, or scanner bypass is suspected;
- startup/auth/message send fails across a release ring;
- mitigation requires rollback, kill switch, provider escalation, user communication, or production configuration change;
- the issue is growing faster than normal ticket triage can contain.

Keep one incident timeline and link support cases to it. Do not duplicate sensitive evidence across tickets.

## Closure quality gate

A defect is not closed until:

- the fix/decision and owner are recorded;
- exact supported platform/version was retested;
- relevant regression and security/permission paths pass;
- release notes/known issues/status guidance are updated when user-visible;
- support has a safe user response and workaround status;
- P0/P1 and repeated P2 incidents have post-incident follow-up actions with owners/dates.

## Operational setup still required

Before stable launch, assign named contacts and private channels for support lead, desktop, auth, messaging/realtime, storage/security, voice, release engineering, operations, trust and safety, privacy/legal, and incident command. Configure access-controlled case/evidence retention and train responders with a tabletop exercise. Repository documentation intentionally contains no personal contact details or provider credentials.
