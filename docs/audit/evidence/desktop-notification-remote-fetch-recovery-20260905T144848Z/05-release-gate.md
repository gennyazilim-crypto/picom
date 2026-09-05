# Release-gate status after history recovery

The canonical source now carries 23 exact recovered applied migrations and one non-forging, exact-version provenance exception. This evidence does not seal a production release manifest and does not authorize `supabase db push`.

The official `supabase db push --linked --dry-run` was then run against the verified production ref. It correctly made no database change but stopped before pending-migration calculation with `Remote migration versions not found in local migrations directory`, naming `20260808220000`. Supabase CLI cannot consume a documented remote-history exception without a local migration file. Adding its generated `;` file would be a prohibited fake historical migration.

Before any production apply, an approved release mechanism must support this exact documented exception without repairing history or materializing fake SQL. It must then revalidate the canonical remote head, exact notification migration LF SHA-256, target ref, feature flag state, named/operator gate under the current release policy, and show exactly one pending version: `20260904100000`.

Production mutation during this recovery: `NONE`.
