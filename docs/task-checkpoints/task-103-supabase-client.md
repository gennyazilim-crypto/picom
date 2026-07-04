# Task 103 checkpoint

- Installed `@supabase/supabase-js`.
- Added a renderer-safe Supabase client factory.
- Guarded client creation behind `VITE_DATA_SOURCE=supabase` and required env values.
- Documented anon-key-only renderer usage and RLS/security implications.
