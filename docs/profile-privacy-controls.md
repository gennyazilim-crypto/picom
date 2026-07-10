# Profile Privacy Controls

- Profile audience can be Everyone, Shared communities, or Friends only.
- Location, timezone, recent activity, and shared media can be hidden independently.
- Privacy settings and optional location/timezone values live in an owner-only table rather than the broadly readable profile row.
- Bidirectional blocks always deny profile projection.
- Activity requires both the owner's activity preference and `can_view_channel`; private-channel activity is never returned to visitors or unauthorized members.
- Media visibility uses the same trusted-context projection. Future signed-media queries must also enforce message/channel access before issuing a URL.
- Mock profile assembly already strips channels/messages the viewer cannot access, then applies the same field projection.

Manual QA: test every audience with self, friend, shared-community member, public visitor, blocked user, private channel activity, and each field toggle.
