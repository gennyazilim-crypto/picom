# Desktop notification remote migration recovery

- Canonical base: `a05619dfac50d6fc9c02eacdd365e877a7236d40`
- Production target: `picom-production` / `cqnsetsmcduraryemhbi` / `eu-central-1`
- Remote migration count: `306`; latest: `20260831112000`
- Notification migration: `20260904100000_production_desktop_notifications.sql`
- Notification migration LF/Git-blob SHA-256: `5FAFBABF8A31812C2F23E3D5C7FCC4E9B0A4709C0754ADA07474B626B26EF502`

An isolated disposable worktree ran `supabase migration fetch --linked` against the verified production ref. The command only rewrote files in that disposable worktree; no production history, schema, data, flag, or deployment was changed.

The fetch source preserved the executable statement sequence for all recoverable remote-only versions. It removes some blank separator lines, so it is not treated as a source-byte oracle. Exact Git blobs with independently verified LF SHA-256 values are used for the 23 recoverable files. `20260803240000` uses the official remote statement form because an older Git candidate was not the executed statement form.

`20260808220000` remains a documented legacy remote provenance gap. No local migration file was created for it.

Status: `GO_WITH_DOCUMENTED_LEGACY_PROVENANCE_EXCEPTIONS`; unexplained remote-only versions: `0`; production mutation: `NONE`.
