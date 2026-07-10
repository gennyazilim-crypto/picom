# Task 263 checkpoint: public read-only community hardening

- Reviewed visitor rules across community/channel/message/attachment RLS, profile privacy, mentions/stories/events, search and deep links.
- Closed a mock/UI parity leak by denying visitor member-directory access while retaining only sanitized visible-message author records.
- Hid the MemberSidebar for visitors and made its toggle explain that joining is required.
- Defined anonymous/visitor/member/cross-community read, write, revocation, realtime and storage test cases.
- Hosted RLS/storage/realtime evidence remains required because Supabase CLI is unavailable locally.

Validation: `npm run typecheck`, `npm run mock:smoke` and `npm run build` were run after the focused hardening change. Supabase pgTAP/hosted RLS tests were not run because the CLI/environment is unavailable and are explicitly retained as release evidence gaps.
