# Client / generated type contract

`npm run onboarding:rpc-contract:smoke` exit 0  
Latest parsed migration: `20260816000000_reconcile_account_onboarding_rpc_contract.sql`

## Client payload (`src/services/onboarding/onboardingService.ts`)

Exact 5 keys, this order:

1. `target_profile`
2. `target_followed_user_ids`
3. `target_theme`
4. `target_start_choice`
5. `target_invite_code`

## Generated types (`src/services/supabase/database.types.ts`)

Args:

1. `target_profile: Json`
2. `target_followed_user_ids?: string[]`
3. `target_theme?: "light" | "dark" | "system"`
4. `target_start_choice?: "createCommunity" | "joinInvite" | "mentionFeed"`
5. `target_invite_code?: string | null`

Returns:

1. `completed: boolean`
2. `completed_at: string`
3. `followed_user_ids: string[]`
4. `theme_mode: "light" | "dark" | "system"`
5. `initial_feed: "mention" | "community" | "invite"`
6. `start_choice: "createCommunity" | "joinInvite" | "mentionFeed"`

No type regeneration performed.
