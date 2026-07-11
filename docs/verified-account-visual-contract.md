# Verified Account Visual Contract

## Canonical identity data

Public verification is represented by one `VerificationSummary`:

```ts
type VerificationSummary = {
  status: "none" | "pending" | "approved" | "rejected" | "revoked";
  type?: "verified_user" | "official_community" | "picom_staff" | "verified_bot";
  approvedAt?: string;
};
```

Only `status === "approved"` with a recognized type can render a public marker. Names, usernames, avatars, roles, presence, custom text, and uploaded media never imply verification. Production data remains sourced through the RLS-protected verification service/repository layer; React components do not query Supabase directly.

## Context variants

| Context | Avatar treatment | Badge placement |
| --- | --- | --- |
| Compact lists | Normal avatar and one neutral border; no aura | `xs` badge after display name |
| Medium headers/messages | Normal avatar; no aura | `xs` or `sm` badge after display name |
| Full Profile Page | Large avatar with approved blue/cyan/purple aura | Profile badge at top-right |

The edit camera remains a separate bottom-right action and appears only on the current user's full profile. Presence remains a bottom-right status dot. Active DM state belongs to the conversation row. Keyboard focus uses `--focus-ring` only under `:focus-visible`.

## Badge and tooltip

`VerifiedBadge` owns a small inline white check SVG and never uses camera, image, edit, role, or presence icons. Its accessible label is independent of color. The custom tooltip is absent by default, opens on hover/focus, closes on leave/blur/Escape/scroll/resize, uses no duplicate native `title`, and does not accept pointer events. It renders through a viewport-clamped `document.body` portal so clipped chat/list containers cannot cover it.

## Labels

- `verified_user`: Verified user
- `official_community`: Official community
- `picom_staff`: Picom staff
- `verified_bot`: Verified bot

Role badges and verification badges must remain separate in layout and semantics.

## Integration contract

The canonical helper is used by Direct Messages, Profile, Community Chat messages, MemberSidebar, Friends, Mention Feed author rows, Popular/Following rows, UserProfilePopover, CommunityHeader, ServerRail labeling, and Command Palette People/Communities search results. No integration may introduce another display-only verification boolean.
