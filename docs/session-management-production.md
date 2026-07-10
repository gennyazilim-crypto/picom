# Session management production

Picom registers safe desktop device metadata through user-scoped Supabase RPCs. The database derives `session_id` from the authenticated JWT and stores only its SHA-256 hash; access tokens, refresh tokens, authorization headers and cookies are never returned or persisted. Settings lists up to 50 current-user devices and marks the current hash server-side.

Revoke other sessions first calls Supabase Auth `signOut({scope:"others"})`, then marks other registered devices revoked and appends a content-free security event. A client subscribed to its own device row emits `user:session_revoked` and the protected-session hook signs out. The current session uses normal Log out.

Supabase provider revocation rejects revoked refresh sessions, but an already-issued access token can remain valid until its short expiry. Realtime publication/disconnect is best effort, not the backend security boundary. The hosted staging environment must verify Auth scope behavior, JWT expiry, Realtime table publication/RLS, sleep/offline recovery, two-window revocation and cross-user denial before production claims.
