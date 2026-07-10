# Announcement Channels Production Behavior

Announcement channels use Picom's normal message ordering, realtime, offline queue, and visibility rules with a stricter posting permission.

## Posting and read-only behavior

Only community owners, administrators, or roles with `sendAnnouncements` can post. Backend `can_send_message_to_channel` is authoritative and the Composer displays a clear read-only reason for everyone else. Visitors may read only when the channel/community public-read policy allows it; private announcement content remains protected by channel RLS.

## Following

Joined members can store a self-owned Follow/Following preference from the channel header. This preference prepares future notification fan-out but does not bypass muted channels, DND, quiet hours, notification permission, or membership checks. Visitors cannot follow until joining.

## distinct styling

Announcement channels use the Coolicons bell treatment, distinct styling through warning/design tokens, and subtle message borders without changing the desktop four-column layout. Normal text channels remain visually unchanged.

## Product boundary

No cross-posting, external syndication, RSS publishing, webhook forwarding, or automatic copy into other communities is implemented. Any future distribution feature requires explicit authorization, per-target permission checks, audit logging, and abuse limits.

## RLS test checklist

1. Owner/admin/`sendAnnouncements` role can post.
2. Normal member and visitor inserts are rejected by message RLS.
3. Private channel messages and follower rows are inaccessible across communities.
4. A user can insert/delete only their own follow preference.
5. Following does not change channel read permission or notification mute behavior.
