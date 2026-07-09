# Picom Beta Feedback Triage

## Categories

| Category | Examples |
| --- | --- |
| Crash | Startup, renderer, native, repeated recovery failure |
| Login | Register, login, logout, OAuth, session restore |
| Onboarding | Step navigation, profile/theme/community/follow completion |
| Mention Feed | Tabs, stories, cards, social proof, companion rail |
| Profile | Full Profile Page, navigation, follow/activity/media |
| Community / chat | Communities, channels, messages, visitor/join/leave/invites |
| Upload | Validation, Storage, attachment grid, image preview |
| Voice | Token, join, mute, deafen, speaking, reconnect |
| Screen share | Source picker, publish, remote view, stop, OS permission |
| Permissions | Role menu, private data, RLS, unauthorized action |
| Packaging | Install, launch, update/reinstall, uninstall, protocol, tray |
| UI / polish | Layout, theme, text, animation, accessibility |

## Severity

| Severity | Definition | Initial response |
| --- | --- | --- |
| Blocker | Prevents beta use/release or exposes private data/secrets | Stop distribution; immediate owner assignment |
| Critical | Core flow broadly unusable or high-risk crash/security defect | Same-day triage and release-impact decision |
| Major | Important flow broken with a limited workaround | Prioritize for next candidate |
| Minor | Localized issue with safe workaround and no data/security risk | Schedule and document if visible |
| Suggestion | Enhancement with no current defect | Product review; not a release blocker |

## Required report fields

- Platform and OS version
- Picom app version
- Build/release channel
- Package type and artifact checksum when packaging-related
- Mock, Supabase staging, or LiveKit staging mode
- Steps to reproduce
- Expected result
- Actual result
- Frequency
- Redacted logs/diagnostics optional

Never request or store passwords, auth/session tokens, authorization headers, Supabase service-role keys, LiveKit secrets, signing credentials, or unrelated private content.

## Triage steps

1. Confirm the report is complete and redact sensitive data.
2. Reproduce on the same platform/build, then one comparison platform when relevant.
3. Assign category and severity.
4. Search for duplicates and link them to one canonical issue.
5. Identify owner, workaround, release impact, and retest criteria.
6. Add confirmed limitations to known issues/release notes.
7. Retest the exact fixed artifact and close only with evidence.

## Immediate escalation

Private-channel/message/attachment leakage, credential exposure, data loss, malicious deep-link/native behavior, package launch failure across the target ring, unusable login/message send, or repeated critical crashes are `blocker` issues and force `NO-GO` until resolved and retested.

