# Blameless Postmortem Template

Use this template for Picom incidents affecting the Electron desktop app, Supabase backend, realtime, database, uploads, LiveKit voice/screen share, or release artifacts.

Do not include secrets, auth tokens, private message content, raw user personal data, passwords, or sensitive screenshots.

## Incident title

- Title:
- Incident ID placeholder:
- Prepared by:
- Review date:

## Date/time

- Detected at:
- Started at:
- Mitigated at:
- Fully resolved at:
- Timezone used:

## Severity

- Severity: SEV0 / SEV1 / SEV2 / SEV3 / SEV4
- Why this severity was chosen:
- Was severity changed during the incident?

## Affected users

- Estimated affected users:
- Affected communities/channels placeholder:
- User segments affected:
- Beta/stable/internal ring affected:

## Affected platforms

- Windows:
- Linux:
- macOS:

## Affected systems

- Desktop app:
- Backend API:
- Realtime:
- Database:
- Uploads/storage:
- Auth/session:
- LiveKit voice/screen share:
- Notifications:
- Release/update pipeline:

## Timeline

| Time | Event | Source/evidence | Owner |
| --- | --- | --- | --- |
| | | | |
| | | | |
| | | | |

## Root cause

Describe the technical and process root cause. Keep this blameless and specific.

- Primary root cause:
- Triggering change/event:
- Why safeguards did not catch it:

## Contributing factors

- Factor 1:
- Factor 2:
- Factor 3:

## What went well

- Detection:
- Communication:
- Mitigation:
- Tooling/process:

## What went poorly

- Detection gaps:
- Response gaps:
- Tooling gaps:
- Documentation gaps:

## User impact

Explain what users experienced in plain language.

- Symptoms users saw:
- Features unavailable or degraded:
- Data impact:
- Workarounds available:

## Detection method

- How the incident was detected:
- Alert/dashboard/support report placeholder:
- Was detection timely?
- What should alert earlier next time?

## Resolution

- Mitigation applied:
- Rollback/hotfix details:
- Verification steps:
- Evidence of recovery:

## Follow-up actions

| Action | Owner | Due date | Priority | Status |
| --- | --- | --- | --- | --- |
| | | | | |
| | | | | |
| | | | | |

## Owners

- Incident commander:
- Engineering owner:
- Operations owner:
- Security owner if applicable:
- Support/product owner:

## Due dates

- Immediate fixes due:
- Medium-term fixes due:
- Long-term prevention due:

## Prevention plan

- Code/test changes:
- Monitoring/alerting changes:
- Runbook/checklist changes:
- Release process changes:
- Training/knowledge-sharing changes:

## Communication summary

- Internal communication sent:
- User-facing communication sent:
- Support notes updated:
- Known issue created/closed:

## Privacy and security review

- Did the incident involve private channels, auth, tokens, or user data?
- Was any sensitive data exposed in logs or diagnostics?
- Were sessions/secrets rotated or revoked?
- Is security sign-off required?

## Links

- Incident response runbook: `docs/incident-response.md`
- Rollback runbook placeholder:
- Release artifact/provenance docs placeholder:
- Related PRs/commits:
- Related support tickets:
