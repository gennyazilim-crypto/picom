# Final verdict — missing migration restore (2026-08-03)

## Restored
- 20260803100000_community_live_screen_sessions.sql sha256=70a2d2a347bb4c19049b61b17ba58a38a6b768373de897499d73dd1f9dec69ee source=3d54872d
- 20260803110000_go_live_broadcast_start.sql sha256=899834c48af8123087955e2a9eced9d5842fcf5298a1ade52acd5441f987b1b4 source=442d999d

## Staging
- History gap for 100000/110000; schema matched (SCHEMA_MATCHED_HISTORY_GAP)
- platform_account_restrictions EXISTS on staging; CREATE migration not in candidate branch

## Production apply
- include-all dry-run: GO (only expected pending versions)
- Applied: 100000, 110000
- Failed: 140000 SQLSTATE 42P01 missing public.platform_account_restrictions
- 140000 rolled back (not in history)

## Verdict
PICOM MISSING MIGRATION ROOT CAUSE: BRANCH_OMISSION_CONFIRMED
PICOM 20260803100000 SOURCE VALIDATION: GO
PICOM STAGING SCHEMA EQUIVALENCE: GO
PICOM OUT_OF_ORDER MIGRATION PLAN: GO
PICOM 20260803100000 PRODUCTION APPLY: GO
PICOM COMMUNITY LIVE SCREEN SCHEMA: GO
PICOM PRODUCTION MIGRATION RESUME: PARTIAL
PICOM PUBLISHER PHASE 1 MIGRATION SEAL: NOT_REACHED
PICOM PUBLISHER PHASE 1 PRODUCTION: PARTIAL_RUNTIME_GATES_PENDING
NEXT_BLOCKER: 20260803140000 requires public.platform_account_restrictions; no creating migration present on feat/community-rebuild (staging has table; production null)
