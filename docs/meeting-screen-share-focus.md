# Meeting screen-share focus

When the first permitted share becomes available, Picom promotes it to the
screen-share layout unless the user explicitly selected another layout. The
previous layout is restored after the automatically promoted share ends. Grid
and Speaker buttons provide an explicit override while sharing continues.

Only one remote screen-share publication is subscribed at a time. The focused
share is dominant and offers Fit, Fill, and Actual Size rendering. Sharer name
and the bounded safe source label remain visible, while a compact participant
column preserves speaking, mute, hand, role, camera/avatar, and identity context.

Muted, unpublished, failed, ended, and participant-disconnected tracks are
removed from the client snapshot before rendering, preventing a stale black
share stage. Provider-owned streams are detached but never stopped by the UI.
