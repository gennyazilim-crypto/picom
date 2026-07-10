# Post-Launch Lessons

Status date: 2026-07-10  
Launch status: **No stable launch occurred**

This report captures release-execution lessons only. It contains no claimed production telemetry, user pain points, support trends, incidents, adoption metrics, or hotfix outcomes because the stable release was blocked by a No-Go decision.

## What went well

- TypeScript, mock mode, Electron/Vite production build, and consolidated local QA passed.
- Release execution separated local/static proof from hosted/native-platform proof.
- Windows unpacked and NSIS candidates were generated using a safe unique temp output.
- Security/preload/IPC/secret/log-redaction and feature smoke contracts provided useful fast feedback.
- Supabase/LiveKit/monitoring preflights print required variable names without printing values or connecting implicitly.
- No artifact was distributed after the No-Go decision.
- No Linux/macOS, hosted RLS, LiveKit, legal, or monitoring success was fabricated.

## What went poorly

- Several smoke tests referenced old component/service boundaries and produced false negatives.
- Environment scanners treated public password-reset redirect variable names as secrets until explicit allowlists were aligned.
- Repository-local Windows packaging repeatedly hit `EPERM` during Electron temp-directory rename.
- Windows single-instance lock prevented isolated packaged startup while the dev instance was running.
- The artifact version/channel remains beta and is not ready for stable provenance.
- Hosted credentials/fixtures, Linux/macOS runners, legal approval, and named operational owners were unavailable.

## User and support findings

- Top user pain points: Unknown; no stable users were released.
- Top support issues: Unknown; no stable support window occurred.
- Adoption/usage: Not measured; no production telemetry claim.
- Hotfix summary: No hotfix window opened.

## Security and privacy observations

- Local RLS/policy inventories, DM participation contracts, Electron boundaries, secret scans, and redaction tests passed.
- Static evidence cannot prove deployed RLS, private Storage, Realtime, or Edge enforcement.
- Final legal/privacy wording and destructive data lifecycle rehearsal remain blockers.
- Production monitoring must avoid raw private messages, credentials, signed URLs, or invasive per-user analytics.

## Platform findings

- Windows: candidate generation works from unique temp output; clean-machine install/UI/uninstall remains pending.
- Linux: Windows AppImage attempt reached packaging but failed at a required symlink; native Linux host required.
- macOS: Electron Builder correctly refuses macOS build on Windows; macOS signing/notarization host required.

## Next phase

Remain in release execution. Do not start post-launch product work until blockers close, a Go decision is recorded, and a real launch/monitoring window exists.
