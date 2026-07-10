# GitHub Actions Actual Failure Root Cause

## Investigation scope

This report is based on GitHub Actions job metadata and failed-step logs. No
failure cause was inferred from local success alone.

The commit titles shown on the Actions page are run titles. They are not
separate workflows. Runs 516 through 523 all used the older two-runner `Picom
QA` workflow. Run 524 used the stabilized workflow from commit `947aedf`.

## Latest failed run

| Field | Evidence |
| --- | --- |
| Workflow run | `29124714084`, Picom QA `#523` |
| Commit | `b9fffd0237ecd4e42f36a15665fdabe38a5077a0` |
| Job | `QA smoke, typecheck, and build (windows-latest)` |
| First failed step by completion time | `Verify third-party license inventory` |
| Failure time | `2026-07-10T21:27:20Z` |
| Command | `npm run licenses:check` |
| Script | `scripts/generate-third-party-licenses.mjs --check` |
| Exact error | `FAIL: Generated license report is missing or stale. Run npm run licenses:generate.` |
| Classification | Cross-platform workflow/script newline mismatch |

The Ubuntu performance-budget step failed two seconds later. It was another
real failure, but it was not the first failed step in the latest failed run.

## User-reported run series

| Run | First failed step by time | Exact cause |
| --- | --- | --- |
| `#516` | Ubuntu `Run QA smoke gate` | Undocumented `VITE_SUPABASE_PASSWORD_RESET_REDIRECT_URL` in `.env.example` |
| `#517` | Ubuntu `Run QA smoke gate` | Same stale env smoke contract |
| `#518` | Ubuntu `Run QA smoke gate` | Same stale env smoke contract |
| `#519` | Ubuntu `Run QA smoke gate` | Same stale env smoke contract |
| `#520` | Ubuntu `Run QA smoke gate` | Same stale env smoke contract |
| `#521` | Ubuntu `Run QA smoke gate` | Same stale env smoke contract |
| `#522` | Ubuntu `Enforce renderer performance budgets` | JS 1742.7 KiB over 1650.0 KiB; CSS 281.4 KiB over 240.0 KiB |

Every Windows job in this run series also failed the license inventory check.
That repeated cross-platform failure became the first failure in run `#523`.

## Verified root cause

The generated license report is deterministic and uses LF newlines. The check
previously compared the checked-out report and generated report with exact
string equality:

```text
current !== report
```

The repository has no `.gitattributes` rule fixing the generated Markdown file
to LF. Windows checkout can therefore present the committed text with CRLF line
endings. The generated in-memory template remains LF. Identical license content
was classified as stale solely because of newline representation.

Evidence supporting this conclusion:

- The same report passed on Ubuntu and failed on Windows for the same commits.
- The generator used exact string comparison without newline normalization.
- GitHub's Windows job failed before any product build or platform package step.
- The error was reproducible as a CRLF/LF comparison difference, not missing
  license metadata or a blocked license expression.

## Minimal fix

`scripts/generate-third-party-licenses.mjs` now normalizes CRLF, lone CR, and LF
to LF before comparing the committed and generated reports.

This does not weaken the license gate:

- Package names, versions, dependency classes, license expressions, counts,
  missing metadata, and blocked expressions must still match exactly.
- Only the operating-system newline representation is ignored.
- The generated file format remains unchanged.

## Related failures already handled

- The stale env contract was corrected in commit `63db036`.
- Commit `947aedf` moved the real performance hard-cap check to the release gate
  rather than deleting or weakening it.
- Run `29125439839` (`#524`) passed `Picom QA / Required QA` in 42 seconds on
  Ubuntu after the workflow responsibility split.

The performance budget remains a truthful release blocker. Moving it out of
ordinary QA does not certify the bundle as release-ready.

## Expected GitHub result

- Required fast QA remains green when typecheck, mock smoke, build, QA smoke,
  static Supabase contracts, security, and license content checks pass.
- The license check is now safe on both LF and CRLF checkouts.
- Actual license inventory changes still fail until the generated report is
  updated and committed.
- Release gate remains blocked by current performance limits and stable No-Go.

## Commands and local results

| Command or validation | Result |
| --- | --- |
| `npm ci` | Passed after stopping the Picom Vite process that locked the native Rolldown binary |
| `npm run licenses:check` | Passed with 395 dependency entries |
| CRLF copy plus real `generate-third-party-licenses.mjs --check` | Passed |
| `npm run typecheck` | Passed |
| `npm run mock:smoke` | Passed |
| `npm run build` | Passed with existing bundle-size warnings |
| `npm run qa:smoke` | Passed |
| `npm run ci:workflow:smoke` | Passed |
| `npm run env:smoke` | Passed |
| All six GitHub workflow YAML files | Parsed successfully |
| `npm run performance:budget:ci` | Failed as expected in release-only evidence: JS 1738.3 KiB and CSS 281.4 KiB exceed hard caps |

The initial `npm ci` attempt hit Windows `EPERM` because the active Picom Vite
process held `rolldown-binding.win32-x64-msvc.node`. Only that Picom process was
stopped, then the clean install passed. This local file lock was not the GitHub
Actions root cause.

## Remaining CI risks

- Initial JavaScript and CSS still exceed release hard caps.
- Hosted validation requires the protected staging environment.
- Real pgTAP validation requires Supabase CLI or hosted staging execution.
- Native package workflows still require runner evidence.
- GitHub reports Node 20 deprecation annotations for v4 JavaScript actions;
  action-version upgrades should be handled separately from this root fix.
