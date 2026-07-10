# Task 265 checkpoint: Stories Header Supabase integration

- Added an RLS-invoker followed-story view for profile status, media, mentions, announcements, events and backend-produced voice activity.
- Added a typed cursor-paginated `storyService` with unchanged mock fallback and wired Supabase startup through the service layer.
- Restricted voice facts to followed users and visible channels; normal renderer clients cannot write voice story rows.
- Preserved existing story UI/viewer/local seen behavior and original Picom gradient artwork.
- Documented source limitations and hosted RLS/manual checks without claiming unavailable Supabase evidence.

Validation: `npm run stories:supabase:smoke`, `npm run stories:header:smoke`, `npm run mock:smoke`, `npm run typecheck` and `npm run build` were run. Hosted RLS execution remains pending because Supabase CLI/environment is unavailable.
