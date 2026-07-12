# Picom V1 Core Scope Freeze

Status date: 2026-07-12
Release: Picom 1.0.0 stable
Stable platform claim: Windows

Task 668 amends the Task 617/621 freeze after real Voice and Screen Share evidence. Historical checkpoints remain unchanged; this file is the current authoritative release-scope copy.

## Classifications

| Classification | Meaning |
| --- | --- |
| IN_V1 | User-visible and required to pass its release gates. |
| CONDITIONAL | Release-scoped only after an explicit operational prerequisite. |
| HIDDEN_FROM_V1 | Source may remain, but V1 navigation, deep link, help, and release copy must not expose it. |
| POST_V1 | Not part of Picom 1.0.0. |
| BLOCKER | Prevents public release until closed. |

## IN_V1

- secure Electron desktop shell and first launch;
- Supabase Auth and production data source;
- Feed, text communities, text messaging, attachments, replies, reactions, and read state;
- Profile, Friends, Direct Messages, Settings, Community Admin, Help, diagnostics, and global search;
- Voice Rooms for every authenticated active community member;
- explicit-action Screen Share for every authenticated active community member.

Voice and Screen Share inclusion is bound to protected runs 29197503222, 29198913461, and 29199409039. Ordinary media access is not role-gated. Visitors, non-members, removed, banned, and suspended users fail closed.

## HIDDEN_FROM_V1 and POST_V1

Radio, Podcasts, Events, Bookmarks, Meeting Workspace, enhanced Noise Shield, discovery marketplace, platform operations, custom emoji/stickers, bots, webhooks as a product surface, plugins, enterprise, SSO/SCIM, billing, AI, recording, captions, and summaries remain gated according to src/config/v1ReleaseScope.ts.

The LiveKit provider webhook is an internal Voice reliability boundary, not the post-V1 community webhook product.

## Release boundary

IN_V1 is a product-scope decision, not public-release authorization. Trusted Windows signing, clean-machine evidence, authorized legal approval, production ownership/custody, and immutable RC evidence remain separate blockers.
