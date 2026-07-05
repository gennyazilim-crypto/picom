# Community insights dashboard

Picom may provide community owners and permitted admins with basic, privacy-conscious community insights after the MVP backend and permission model are stable. This document defines the dashboard placeholder without enabling a production analytics feature.

This dashboard is community-scoped. It is not an app-level Trust and Safety dashboard and not an enterprise analytics console.

## Goals

- Help community owners/admins understand high-level community health.
- Avoid exposing invasive user behavior or private message content.
- Keep metrics useful for moderation and community operations.
- Respect private channel visibility and Supabase RLS.
- Preserve the premium desktop app experience if implemented later.

## Non-goals for MVP

- No production analytics provider integration.
- No mobile UI.
- No cross-community public leaderboard.
- No individual surveillance dashboard.
- No message content analytics.
- No raw private channel data exposure.
- No heavy charting dependency unless later justified.

## Future metrics

Initial community insights may include:

- member count
- online count placeholder
- messages last 24 hours
- active channels
- new members
- top channels by message count
- attachment count placeholder
- event count placeholder
- report count placeholder
- moderation action count placeholder

Privacy-safe defaults:

- aggregate counts first
- channel-level metrics only for channels the viewer can manage/view
- no private message content
- no detailed per-user activity timeline
- no exact online history beyond current presence summary

## Future Supabase/service placeholder

Potential service method:

- `getCommunityInsights(communityId)`

Potential route or Edge Function:

- `GET /communities/:communityId/insights`

Response shape placeholder:

```ts
export type CommunityInsightsSummary = Readonly<{
  communityId: string;
  generatedAt: string;
  memberCount: number;
  onlineCountPlaceholder: number;
  messagesLast24h: number;
  activeChannelCount: number;
  newMembersLast7d: number;
  attachmentCountPlaceholder: number;
  eventCountPlaceholder: number;
  topChannels: ReadonlyArray<{
    channelId: string;
    channelName: string;
    messageCount: number;
  }>;
}>;
```

The renderer should call a service layer only. It must not use service-role keys or privileged direct Supabase queries.

## Permissions and RLS

Future access should require one of:

- community owner
- admin with `manageCommunity`
- role with future `viewInsights` permission

RLS/server-side checks must enforce:

- viewer is a member of the community
- viewer has insights permission
- private channel metrics are excluded unless viewer can access/manage that channel
- normal members cannot access insights
- visitors cannot access insights

Renderer-side hiding is UX only and not a security boundary.

## UI placeholder plan

Future desktop UI location:

- Community Management Center > Insights

Desktop design expectations:

- compact metric cards
- small token-based bars or simple lists instead of heavy chart dependency
- empty state for small/new communities
- clear timestamp for when metrics were generated
- light/dark token support
- Coolicons through `AppIcon`
- no Discord branding/assets/colors
- no mobile layout

Suggested sections:

- Overview cards
- Activity summary
- Top channels
- Membership trend placeholder
- Safety/moderation summary placeholder

## Data safety rules

Do not expose:

- passwords
- auth tokens
- cookies
- authorization headers
- Supabase service-role keys
- LiveKit secrets
- raw message content
- deleted/anonymized user private data
- private channel names to unauthorized viewers
- exact user-by-user online history

Allow only:

- aggregate counts
- permitted channel identifiers/names
- safe timestamps
- safe status enums
- redacted metadata

## Performance notes

Insights queries can become expensive. Future implementation should:

- calculate aggregates server-side
- cache short-lived summaries if needed
- avoid scanning all messages from the renderer
- paginate top-channel/detail lists if added
- avoid blocking chat startup on insights loading
- expose stale/empty states gracefully

## MVP status

- Community insights are documented as a future placeholder.
- No production insights route is enabled yet.
- No runtime dashboard is exposed in this task.
- Future implementation must use Supabase Auth, RLS/trusted service boundaries, aggregate-only privacy defaults, and the existing desktop design tokens.
