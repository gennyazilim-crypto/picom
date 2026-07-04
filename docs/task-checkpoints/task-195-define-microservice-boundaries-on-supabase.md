# Task 195 - Define microservice boundaries on Supabase

## Scope

- Documented the Supabase-native microservice boundary model for Picom.
- Separated renderer + RLS workflows from Edge Function workflows.
- Documented SQL/RLS expectations, environment variables, and verification steps.

## Runtime impact

- Documentation-only task.
- No renderer, Electron, Supabase runtime, or UI code changed.

## Verification

- Run `npm run supabase:smoke` to confirm the local Supabase schema workflow remains present.
- Review `docs/supabase-microservice-boundaries.md` before adding new privileged backend flows.
