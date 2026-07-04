# Task 107 - Profiles table schema

Picom now has a focused profiles schema hardening migration.

## Migration

- `supabase/migrations/20260704000200_profiles_schema.sql`

## Validation constraints

- Username length: 3 to 32 characters.
- Username format: lowercase letters, numbers, dots, underscores, and hyphens.
- Display name length: 1 to 80 characters.
- Status text max length: 120 characters.
- Bio max length: 500 characters.
- Accent color must be a hex color if present.

## Indexes

- Case-insensitive unique username index with `lower(username)`.
- Status lookup index for presence/member list queries.

## RLS note

RLS was enabled for `profiles` in the baseline migration. Follow-up policy tasks should ensure users can update only their own profile and read only profiles visible through shared community context.

## Manual verification

1. Apply the baseline migration.
2. Apply this profiles migration.
3. Insert a valid profile for an auth user.
4. Confirm invalid usernames are rejected.
5. Confirm duplicate usernames with different casing are rejected.
