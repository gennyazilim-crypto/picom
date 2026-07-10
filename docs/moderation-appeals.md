# Moderation appeals foundation

The production-oriented source of truth is [Appeals workflow](appeals-workflow.md). Picom now has typed appeal states, a service boundary, an affected-user action ledger contract, Supabase schema/RLS, state-transition guards, redaction, and append-only decision audit hooks.

No broad moderation UI or automatic reversal is enabled. A trusted backend must create an appealable action record before an affected user can submit a production appeal.
