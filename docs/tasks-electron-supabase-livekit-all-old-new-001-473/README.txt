# Task Replacement Patch

This ZIP contains corrected replacement TXT files for the tasks that were too vague in the 001-473 master package.

## What to do
1. Do not run Codex on all files at once.
2. Replace the matching task_XXX.txt files in your master pack with the files in `replacements/`.
3. Keep `extra_recommended_additions/task_127_ADDENDUM_first_run_onboarding.txt` as an addendum or merge it into task_127.
4. Run one task at a time.
5. Test and commit after each task.

## Most critical replacements
- 103-121: Supabase SQL/schema/types/seed
- 130-141: RLS and RLS tests
- 142-157: Supabase service/data-source layer
- 164-178: Storage/upload security
- 179-190: Realtime subscriptions/presence/unread
- 195-203: Edge Functions and JWT security
- 214-228: LiveKit voice/screen share details
- 254-275: Electron packaging hardening
- 290-310: logs/diagnostics/tests QA hardening
- 362-365: feature flags/remote config/version/scaling
- 393: safe external links
- 457-460: timeout/backpressure/send queue/update recovery

## Count
Replacement files: 150
Extra addendum files: 1

