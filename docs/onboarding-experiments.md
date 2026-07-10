# Onboarding Experiments

## Guardrails

- `enableOnboardingExperiment` is default-off and may be enabled only through the existing typed environment/remote feature-flag path.
- Control preserves the current order. Guided moves community and follow choices before appearance while keeping the same five desktop steps and the same completion behavior.
- Profile and Finish remain required. Theme, Community, and Follow retain visible Skip actions in both variants.
- No countdowns, forced follows, hidden defaults, fake urgency, preselected paid actions, or blocked navigation are permitted.

## Assignment and privacy

When enabled, Picom assigns `control` or `guided` deterministically in memory. `VITE_ONBOARDING_VARIANT=control|guided` is available for staging QA. Assignment is not written with a user identifier.

The local result store contains only two aggregate counters per variant: `started` and `completed`. It excludes user IDs, profile values, invite codes, community choices, follow selections, timestamps, IP addresses, device identifiers, and step-level events. No real analytics provider is enabled.

## Results template

| Variant | Started | Completed | Completion rate | Notes |
| --- | ---: | ---: | ---: | --- |
| Control | TBD | TBD | TBD | Staging/internal cohort only |
| Guided | TBD | TBD | TBD | Staging/internal cohort only |

Do not make product claims until sample size, accessibility feedback, and support impact are reviewed. Disable the flag to return every user to the control path immediately.
