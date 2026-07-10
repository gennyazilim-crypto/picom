# GitHub Actions Failure Taxonomy

Use this taxonomy when triaging Picom CI. A red job must keep its real meaning;
do not convert failures to green with `continue-on-error`.

| Class | Example | Owner | Workflow home | Release impact |
| --- | --- | --- | --- | --- |
| Real application failure | Typecheck, mock smoke, or build regression | Application engineering | Fast QA | Blocks merge |
| Stale test or generated evidence | Env allowlist or license report not updated | Change author | Fast QA | Blocks merge until synchronized |
| Unavailable secret | Protected staging or signing value absent | Operations/security | Hosted or signed release | Blocks requested certification, not ordinary QA |
| Unavailable hosted service | Supabase or LiveKit staging outage | Backend/operations | Hosted validation | Blocks hosted evidence |
| Wrong operating-system runner | Native package command on a non-native runner | Release engineering | Package matrix | Blocks affected platform package |
| Packaging limitation | EPERM, missing system package, or target tool failure | Release engineering | Package matrix | Blocks affected platform candidate |
| Signing/notarization limitation | Missing certificate or notarization failure | Release/security | Signed release workflow | Blocks trusted release |
| Flaky timing test | Race or unstable timeout | Test owner | Closest deterministic workflow | Blocks until reproduced or corrected; never hidden |
| Missing dependency | Lockfile or install inconsistency | Change author | Fast QA | Blocks merge |
| Duplicated workflow | Same evidence executed more than once per commit | CI owner | Workflow triggers | Wastes minutes; does not change evidence |
| Canceled superseded run | New commit replaces an in-progress same-ref run | CI system | Fast QA/package | Neutral; expected optimization |
| Documentation-only unnecessary run | Native or hosted checks on docs-only changes | CI owner | Optional job conditions | Should be avoided without leaving required checks Pending |
| Artifact/upload issue | Missing expected package or unsafe broad glob | Release engineering | Package/signed workflow | Blocks evidence publication |
| Environment mismatch | Node/runtime differs from supported CI baseline | CI owner | All workflows | Blocks until baseline is aligned |
| Performance budget failure | JS or CSS exceeds hard cap | Frontend/performance | Release gate | Real release-readiness blocker |

## Triage order

1. Identify the exact failed step and workflow responsibility.
2. Reproduce deterministic commands locally when possible.
3. Determine whether the failure needs source, test, environment, or workflow
   correction.
4. Keep hosted and release evidence blocked when its environment is absent.
5. Record recurring causes in the QA audit and release blocker documents.

## Current high-frequency causes

Recent evidence ranked stale generated licenses first, stale env-contract data
second, and real renderer performance hard-cap failures third. The first two
belong in fast QA. Performance remains a release-gate failure and must be fixed
in the product bundle rather than weakened in CI.
