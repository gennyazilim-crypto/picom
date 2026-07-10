# Mobile Strategy Reassessment

## Current decision

Picom remains a **Windows, Linux and macOS Electron desktop product**. iOS and Android are not approved product surfaces, and no mobile UI, responsive mobile route, native wrapper or store package is part of the current roadmap.

Mobile work should begin only after the desktop product demonstrates stable retention, reliable Supabase/LiveKit operations and a funded mobile-specific support plan. A mobile client must be treated as a separate product, not as a compressed version of the four-column desktop interface.

## Why mobile remains deferred

- The current interaction model depends on persistent desktop columns, hover actions, context menus, keyboard shortcuts, tray behavior and Electron-native window controls.
- Voice, screen sharing, media permissions, background behavior and notifications differ materially on iOS and Android.
- App-store review, signing, privacy manifests, background policies and release operations add independent ongoing cost.
- Supporting another client multiplies API compatibility, realtime ordering, session revocation, accessibility, localization and QA obligations.
- A web-first responsive retrofit would risk the premium desktop layout without producing a production-quality native mobile experience.

## Candidate approaches

### React Native

Best fit if Picom later prioritizes native controls and mature iOS/Android ecosystems while reusing TypeScript domain knowledge. UI components and Electron services would not be reusable; DTOs, validation rules and selected service contracts could be shared.

### Native Swift/Kotlin

Highest platform fidelity and clearest access to background/notification/media APIs, but requires two specialized implementations and the highest engineering/support cost.

### Flutter

One cross-platform mobile UI codebase with strong custom rendering, but introduces Dart and a separate component/state ecosystem. TypeScript UI and service implementations would not carry over.

### Capacitor/web wrapper

Lowest initial prototype cost but the weakest fit for Picom's realtime, voice, background, notification and native desktop-quality ambitions. It should not be selected merely to reuse the renderer.

No approach is selected. A later discovery phase must prototype the hardest native flows before committing.

## Reuse analysis

| Area | Reuse potential | Required mobile work |
| --- | --- | --- |
| Supabase schema and RLS | High | Re-audit policies for mobile session/storage behavior |
| Supabase Auth | Medium to high | Mobile deep links, secure token storage, provider setup and recovery tests |
| Supabase Realtime | Medium | App lifecycle reconnect, background limits, ordering and battery controls |
| Supabase Storage | Medium to high | Native picker, upload cancellation, compression, cache and permission handling |
| LiveKit rooms | Medium | Native SDK integration, audio routing, interruptions, Bluetooth and background policy |
| LiveKit screen share | Low to medium | ReplayKit/MediaProjection extensions, permissions and store-policy review |
| Shared DTOs/error codes | High | Extract platform-neutral contracts into a versioned package |
| Permissions/business rules | Medium to high | Keep server enforcement; port only platform-neutral client helpers |
| React components/CSS | Low | Design a mobile-specific information architecture and components |
| Electron IPC/services | None | Replace with platform-native service abstractions |
| Mock data/test fixtures | Medium | Adapt deterministic fixtures to mobile test harnesses |

Backend reuse never removes the need for RLS and authorization tests from an independently compromised mobile client perspective.

## Estimated scope and cost drivers

A credible mobile MVP would require, at minimum:

- Product discovery and mobile information architecture.
- iOS/Android design system adaptations and accessibility review.
- Secure auth storage, deep links, account recovery and session revocation.
- Community/channel/message/reaction/reply parity decisions.
- Realtime lifecycle, offline queue and conflict behavior.
- Camera/photo/file selection, compression, upload and private media caching.
- Push notification provider and permission onboarding.
- LiveKit microphone, audio route, interruption and optional screen-share work.
- Crash reporting, privacy disclosures and diagnostic redaction.
- Store accounts, signing, build CI, beta distribution and release review.
- Device matrix testing and ongoing platform-version maintenance.

Cost should be estimated with a dedicated mobile team and a staged prototype. Reusing the backend reduces server duplication but does not remove mobile product, native integration, QA or operations work.

## Prerequisites for reconsideration

- Stable desktop beta metrics and a validated mobile user need.
- Approved product scope defining which desktop features are intentionally excluded.
- Versioned API/realtime contracts and supported-client policy.
- Mature RLS tests, incident response and backend capacity plan.
- Production push notification and privacy strategy.
- LiveKit native proof of concept for audio routing and lifecycle recovery.
- Funded iOS/Android QA device matrix and support ownership.
- App-store legal, privacy, signing and release accounts.

## Recommended discovery sequence

1. Interview desktop users and quantify mobile use cases; do not assume full parity.
2. Define a narrow mobile MVP and explicit exclusions.
3. Compare React Native, native Swift/Kotlin and Flutter against auth, realtime, uploads and voice prototypes.
4. Build throwaway technical spikes for deep-link auth, background reconnect, push and LiveKit audio.
5. Perform security/privacy and store-policy reviews.
6. Produce a staffed delivery estimate and Go/No-Go decision.

Discovery artifacts must remain outside the production desktop renderer until a mobile product is approved.

## Explicit non-goals today

- No mobile layout or CSS breakpoint in the Electron app.
- No iOS or Android project scaffold.
- No responsive web substitute for a native client.
- No mobile store metadata, signing or release pipeline.
- No promise of desktop feature parity.

## Reassessment trigger

Revisit this decision only through an architecture/product review with measurable demand, approved funding, named owners and a mobile-specific release plan. Until then, all UI and QA acceptance criteria remain desktop-only.

