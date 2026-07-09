# Picom Post-Launch Feedback Summary

## Evidence status

No public stable launch has occurred and the stable decision is No-Go. Therefore there is no genuine post-launch 72-hour feedback dataset, support volume, cohort metric, or user-impact trend to summarize.

Current sources are limited to:

- Beta feedback/triage workflow with no repository-recorded reports.
- Confirmed QA blockers fixed in Task 25.
- `docs/beta-known-issues.md`.
- Stable RC blocker review and No-Go decision.
- Static QA/build/security/package/Supabase/LiveKit checks.
- External/native verification gaps documented in Tasks 27-42.

Zero recorded reports is not evidence of zero defects.

## Confirmed engineering feedback

| Category | Evidence | Impact | Disposition |
| --- | --- | --- | --- |
| Blocker/bug | Renderer env example included CLI-only variables; stale QA contracts | Quality gate failed | Fixed and regression-covered |
| Supabase/RLS | Real deployed pgTAP/account matrix not run | Stable privacy/access confidence incomplete | P0 release blocker |
| Upload/Storage | Historical private attachments need signed-URL refresh after reload | Remote images can become unavailable; access model incomplete | P0 implementation/verification |
| Realtime | Two-window deployed reconnect/private subscription not tested | Duplicate/missing/private event risk | P0 verification |
| Voice/screen share | Deployed/native two-client test missing | Media readiness unknown | P0 verification |
| Packaging | Linux/macOS native artifacts/smoke absent; stable signing incomplete | Stable platform distribution blocked | P0 release engineering |
| Legal/policy | Terms/Privacy remain beta placeholders | Public release/legal risk | P0 sign-off/content |
| Backup/restore | Runbook exists, no real restore drill | Recovery readiness unproven | P0 operations |
| Performance | Vite chunk warning >500 kB | Potential startup/load cost | P1 measure and optimize |

## Requested category status

- **UX polish:** no measured post-launch findings; accept only reproducible reports after core blockers.
- **Performance:** bundle warning and first-run budget need measured native baselines.
- **Voice/screen share:** native/provider verification required before feature expansion.
- **Supabase/RLS:** deployed security matrix and private attachment delivery are first priority.
- **Onboarding:** existing MVP works in static/mock paths; collect completion/drop-off reports without adding analytics prematurely.
- **Social login:** provider configuration/native callback smoke remains environment work.
- **Community management:** role-aware MVP exists; prioritize only confirmed permission/admin defects.
- **Moderation:** keep MVP safety flows; advanced systems require separate scope.
- **DM/friends:** not part of current Full MVP delivery; reconsider only after core stability and scope approval.
- **Bots/webhooks, plugin/platform, enterprise, analytics:** intentionally parked, not silently added to MVP+.

## Feedback conversion rules

1. Link each backlog item to a redacted report, test failure, incident, known issue, or measured signal.
2. Separate defect, release evidence gap, UX request, and new product scope.
3. Assign impact, affected platform/version/environment, confidence, owner, acceptance evidence, and target priority.
4. Security/privacy and data-loss issues override popularity.
5. Do not promote suggestions based only on one unverified request.
6. Re-triage after real beta/stable launch data exists.

## Next evidence collection

- Complete stable blockers and run a controlled beta/stable ring.
- Use the structured in-app feedback report and 72-hour monitoring plan.
- Track duplicates and platform/environment cohorts without collecting message content or secrets.
- Publish a new dated summary after real feedback exists.
