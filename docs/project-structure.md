# Picom Project Structure

```text
picom/
├─ electron/                 Electron main/preload/config and native service wiring
├─ src/                      React renderer application
│  ├─ components/            Desktop views, chat surfaces, overlays, auth/settings/voice UI
│  │  ├─ auth/
│  │  ├─ community/
│  │  ├─ feedback/
│  │  ├─ legal/
│  │  ├─ onboarding/
│  │  ├─ settings/
│  │  └─ voice/
│  ├─ config/                Renderer-safe application configuration
│  ├─ data/                  Typed mock data, templates, legal placeholder content
│  ├─ hooks/                 React integration/subscription hooks
│  ├─ lib/                   Small internal libraries/helpers
│  ├─ services/              Domain/data/native/backend service abstractions
│  │  ├─ auth/
│  │  ├─ community/
│  │  ├─ desktop/
│  │  ├─ diagnostics/
│  │  ├─ livekit/
│  │  ├─ logging/
│  │  ├─ onboarding/
│  │  ├─ permissions/
│  │  └─ supabase/
│  ├─ state/                 Shared/normalized state foundations
│  ├─ types/                 Renderer/domain TypeScript types
│  ├─ utils/                 Pure utilities
│  ├─ App.tsx                Root view/state integration
│  ├─ main.tsx               React entry
│  └─ styles.css             Global design tokens and desktop styles
├─ supabase/
│  ├─ migrations/            Ordered schema/RLS/Storage/Realtime SQL
│  ├─ functions/             Edge Functions and shared server helpers
│  ├─ tests/                 RLS pgTAP/SQL evidence
│  ├─ config.toml            Local function/Auth/Storage configuration
│  └─ seed.sql               Development-only synthetic seed
├─ packages/shared/          Safe DTO/permission/event/pagination types
├─ assets/brand/             Picom logo/app icons/multi-size package icons
├─ public/                   Public renderer assets
├─ scripts/                  QA, safety, maintenance, release, and smoke commands
├─ docs/                     Architecture, runbooks, scope, release, QA, checkpoints
├─ .github/                  CI workflow placeholders/gates
├─ electron-builder.yml      Windows/Linux/macOS package metadata/targets
├─ vite.config.ts            Renderer build with packaged relative asset base
├─ tsconfig.json             Renderer/shared TypeScript configuration
├─ tsconfig.electron.json    Electron TypeScript build configuration
├─ package.json              Commands/dependencies/version
└─ README.md                 Project entrypoint
```

## Generated/local-only outputs

- `node_modules/`: installed dependencies.
- `dist/`: Vite renderer build.
- `dist-electron/`: compiled Electron main/preload.
- `release/`: electron-builder artifacts.
- `.env`, `.env.local`, `.env.production`, `.env.*.local`: local/secret configuration.
- Runtime logs/temp files.

Do not commit these outputs/secrets. `.env*.example` files contain public values or empty/obvious placeholders only.

## Dependency direction

- React components call services/hooks.
- Services choose mock/Supabase/native implementations.
- Components do not call `supabase.from`, Electron, Node, shell, or filesystem APIs directly.
- Electron renderer accesses whitelisted native functions through preload/service wrappers.
- Frontend permission checks improve UX; Supabase RLS/Function authorization enforces security.
- Shared package exposes safe DTOs only, never Prisma/database entities or secrets.

## Design system

`src/styles.css` owns Picom variables for backgrounds/surfaces/text/borders/accent/status/shadow/radius/focus and desktop layouts. Components should consume tokens. `AppIcon` is the icon wrapper; do not introduce another icon family.

## Data modes

- Mock: deterministic local app behavior from `src/data` and mock branches in services.
- Supabase: service layer uses configured Supabase client and RLS-backed APIs.

UI components must not switch data sources directly.
