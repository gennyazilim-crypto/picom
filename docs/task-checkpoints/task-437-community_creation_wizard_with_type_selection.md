# Task 437 - Community Creation Wizard with Type Selection

Status: COMPLETE WITH LIVE UI AND HOSTED INSERT EVIDENCE BLOCKED

## Outcome

- Extended the existing create-community modal into a three-step desktop wizard.
- Made Text, Radio, or Podcast selection the required first step.
- Added original Picom capability/limitation cards and token-only styling.
- Collected name, description, optional HTTPS icon, visibility, public-read policy, and optional Text starter template.
- Persisted selected kind and all settings through mock/Supabase service calls.
- Opened Text chat, Radio live audio, or Podcast audio/podcast tab immediately after creation.
- Connected onboarding's Create Community choice to the same wizard.
- Kept invite acceptance kind-aware for the opened shell.
- Returned service errors to the wizard instead of emitting a raw placeholder toast.

## Task files

- `src/components/CreateCommunityModal.tsx`
- `src/components/CreateCommunityModal.css`
- `src/components/onboarding/OnboardingStepCommunity.tsx`
- `src/components/audio/CommunityAudioView.tsx`
- `src/services/communityService.ts`
- `src/App.tsx`
- `scripts/typed-community-creation-wizard-smoke.mjs`
- `docs/task-checkpoints/task-437-community_creation_wizard_with_type_selection.md`
- `package.json`

## Security and data notes

- Type, name, icon, visibility, and public-read values are validated in the modal and service layer.
- The PostgreSQL enum remains the final kind boundary; RLS remains the access boundary.
- Private creation always forces public read off.
- Radio/Podcast creation never silently falls back to Text.

## Commands and results

- `npm ci` - PASS, 0 vulnerabilities.
- `npm run community:kind:smoke` - PASS.
- `npm run community:kind:backfill:smoke` - PASS.
- `npm run community:creation:typed:smoke` - PASS.
- `npm run onboarding:experiments:smoke` - PASS.
- `npm run mock:smoke` - PASS.
- `npm run supabase:api-regression` - PASS.
- `npm run community:access:smoke` - PASS.
- `npm run audio:mvp:qa` - PASS.
- `npm run visual:regression:contract` - PASS for coverage contract; no pixel run claimed.
- `npm run e2e:coverage:contract` - PASS for coverage map; no UI runner execution claimed.
- `npm run accessibility:display:smoke` - PASS.
- `npm run typecheck` - PASS.
- `npm run build` - PASS.
- `npm run qa:smoke` - PASS.
- `npm run performance:budget:ci` - PASS.

Validation ran in a detached clean worktree based on commit `788d534` with only Task 437 files overlaid. User-owned Iconix/AppIcon and release output were excluded.

Performance remained within hard limits: 2,779.6 KiB total assets, 1,411.8 KiB largest JS chunk, 222.7 KiB largest CSS chunk, and 29 generated assets.

## Manual and blocked evidence

- Wizard forward/back/cancel/error logic, focus-visible styling, reduced motion, all three kind payloads, and kind-aware routing are covered by source contracts and TypeScript.
- Interactive pointer/keyboard walkthrough is BLOCKED because the repository's Playwright/Electron UI runner is not active; the E2E command explicitly reports coverage-only status.
- A real hosted Supabase INSERT for each kind is BLOCKED because no hosted credentials were used and Supabase CLI is unavailable.
- Required follow-up: create Text/Radio/Podcast in mock UI, then repeat against disposable staging and verify `communities.kind`, visibility, public-read, and the opened shell.
