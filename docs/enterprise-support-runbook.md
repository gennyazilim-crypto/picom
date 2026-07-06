# Enterprise support runbook

This runbook defines how Picom support should handle enterprise customer issues while protecting secrets, private messages, credentials, and tenant boundaries. It is specific to the Windows, Linux, and macOS Electron desktop app plus Supabase/LiveKit backend services.

## Status

Operational runbook. It does not add support tooling runtime or expose customer data.

## Goals

- Give support a consistent triage path for enterprise customers.
- Keep diagnostics privacy-safe and redacted.
- Define escalation paths for desktop, backend, realtime, uploads, auth, and compliance issues.
- Separate support investigation from unauthorized data access.
- Link support actions to incident response and postmortem workflows when needed.

## Support principles

- Ask for minimum necessary diagnostic information.
- Never ask users for passwords, tokens, recovery codes, or private keys.
- Do not request screenshots containing secrets or private messages unless absolutely necessary and approved.
- Prefer exported redacted logs over raw terminal output.
- Respect organization/community access boundaries.
- Escalate suspected private channel leaks immediately.

## Intake checklist

Collect:

- customer organization placeholder
- affected platform: Windows, Linux, or macOS
- app version and release channel
- approximate time and timezone
- affected feature
- expected behavior
- actual behavior
- reproduction steps
- whether issue affects one user, one community, or many users
- redacted support logs if available
- screenshots with sensitive content removed

Do not collect:

- passwords
- auth tokens
- Supabase service role keys
- LiveKit API secrets
- payment details
- raw private messages unless approved through a formal compliance process

## Severity levels

### Sev 1

Customer-wide outage, data leak suspected, auth unavailable, message send broadly failing, corrupted release, or private channel access leak suspected.

Action: escalate to incident response immediately.

### Sev 2

Major feature impaired for a customer, realtime unreliable, uploads failing broadly, voice unusable for many users, or admin access broken.

Action: assign engineering owner and monitor for incident escalation.

### Sev 3

Single-user or limited workflow issue with workaround.

Action: normal triage and scheduled fix.

### Sev 4

Question, documentation gap, cosmetic issue, or feature request.

Action: support response and backlog routing.

## Triage by area

### Desktop app

Check:

- app version
- platform and architecture
- whether app starts
- safe mode status
- crash recovery prompt
- logs viewer/export output
- titlebar/window control issues
- theme/layout rendering

### Auth/session

Check:

- login/register path
- session restore
- revoked session handling
- SSO placeholder status if enterprise asks
- account activity if available

Never ask for passwords or tokens.

### Messaging/realtime

Check:

- channel permissions
- private channel visibility
- realtime connection status
- message send queue status
- duplicate/failed/queued messages
- Supabase Realtime health

### Uploads

Check:

- file type and size
- validation error
- storage provider status
- attachment metadata
- scanning/quarantine placeholder status

Do not request raw sensitive attachments unless approved.

### Voice/screen share

Check:

- LiveKit token flow
- microphone/screen permissions
- platform-specific capture permissions
- room join/leave state
- mute/deafen status

### Security/compliance

Escalate immediately for:

- private channel leak suspected
- unauthorized admin access
- suspicious export/access request
- secret exposure
- data loss suspected
- legal hold/retention dispute

## Redaction requirements

Before sharing logs internally or externally, remove:

- passwords
- auth headers
- session tokens
- API keys
- service role keys
- LiveKit secrets
- webhook tokens
- SAML assertions
- SCIM bearer tokens
- payment provider secrets
- private file paths where not needed

## Escalation path placeholder

- Support owner placeholder
- Engineering owner placeholder
- Security owner placeholder
- Operations owner placeholder
- Product owner placeholder
- Customer communication owner placeholder

## Customer communication template

Acknowledge:

- issue received
- affected platform/feature understood
- no secrets requested
- next update time placeholder
- workaround if available

Avoid speculative root cause until confirmed.

## Closure checklist

- Customer confirms resolution or workaround.
- Internal ticket has root cause or linked incident.
- Logs/diagnostics are stored according to retention policy.
- Sensitive attachments are deleted or protected according to policy.
- Follow-up actions have owners and dates.
- Documentation is updated if the issue was preventable.

## Related docs

- `docs/incident-response.md`
- `docs/postmortem-template.md`
- `docs/staging-smoke-test.md`
- `docs/rollback-runbook.md`
- `docs/secrets-management.md`
- `docs/beta-feedback-triage.md`
