# Web App Strategy Reassessment

## Current decision

Picom remains a **Windows, Linux and macOS Electron desktop application**. A publicly distributed browser application is not approved. The Vite renderer being technically loadable in a browser is a development characteristic, not proof that Picom has a secure, supported web product.

No web deployment, web-first route, responsive redesign, service worker or browser release pipeline is introduced by this decision.

## Electron remains the primary distribution

Electron currently provides the product boundary Picom is designed around:

- A controlled application window and custom titlebar.
- Safe preload-mediated window, tray, notification, clipboard, deep-link and screen-source services.
- Predictable desktop keyboard, context-menu and drag/drop behavior.
- Packaged protocol registration for auth and navigation callbacks.
- Desktop-centric multi-column information density and minimum window size.
- A release artifact that can be versioned, signed, checked and supported as one client.

The existing browser fallback paths are useful for development and graceful service abstraction, but they do not establish production web parity.

## Potential reasons for a future web version

- Frictionless read-only or lightweight access on unmanaged devices.
- Faster onboarding before a desktop installation.
- Accessibility from environments where application installation is prohibited.
- A limited support/admin surface separated from the community client.

These use cases should be validated independently. They do not imply that the full desktop renderer should be published unchanged.

## Browser limitations and product gaps

| Area | Electron desktop | Browser impact |
| --- | --- | --- |
| Window/tray/startup | Controlled native bridge | Unavailable or browser-defined |
| Custom protocol callbacks | Packaged registration | HTTPS redirect and tab lifecycle required |
| Notifications | Native bridge with fallback | Permission, browser and background-delivery constraints |
| Screen capture | Desktop source picker | Browser picker and permission behavior vary |
| Voice lifecycle | Desktop process lifecycle | Tab suspension, autoplay and background throttling |
| File/cache/log services | Bounded preload services | Sandbox storage quotas and browser-specific clearing |
| Keyboard/context menus | Desktop-focused | Browser/OS shortcut conflicts |
| Single instance/window state | Supported by main process | Not applicable |
| Offline behavior | Controlled app lifecycle | Service-worker/cache strategy required |
| Release compatibility | Packaged version metadata | Cached assets and rolling deployment compatibility |

The four-column desktop UI must not be converted into a responsive web/mobile layout as a side effect of web exploration.

## Security assessment

A public web origin changes Picom's threat model:

- Any XSS can operate inside the authenticated web origin; CSP, dependency review and unsafe-HTML prevention become release blockers.
- Public browser clients are fully untrusted. Supabase RLS, Storage policies, Edge Function authorization and LiveKit token scoping must enforce every boundary.
- Auth requires approved HTTPS redirects, secure browser storage behavior, CSRF/state controls and account-recovery testing.
- CORS and `connect-src` must allow only known Supabase, LiveKit and Picom endpoints.
- Private attachments require authorization-aware delivery; public object URLs cannot substitute for channel access checks.
- Source maps, environment variables and built assets must contain no private keys or privileged endpoints.
- Browser extensions and shared devices increase privacy and token-exposure concerns.
- Abuse controls must assume automated, modified and headless clients.

Electron is also an untrusted client at the backend boundary, so web deferral never weakens the requirement for server/RLS enforcement.

## Reuse potential

| Area | Reuse potential | Conditions |
| --- | --- | --- |
| Supabase schema/RLS | High | Complete hosted policy and tenancy tests |
| DTOs, error codes, selectors | High | Keep platform-neutral and versioned |
| React presentation components | Medium | Remove Electron assumptions without redesigning desktop UI |
| Data/service interfaces | Medium | Explicit web adapters and abort/lifecycle behavior |
| Design tokens/AppIcon | High | Preserve Picom identity and accessibility |
| Electron preload/main services | None | Replace with bounded browser adapters |
| Voice/screen share UI | Medium | Browser-specific permission and lifecycle implementation |
| Packaging/release operations | None | Add secure hosting, cache invalidation and rollback |

Shared code should be extracted only when a real second client is approved; speculative abstraction must not destabilize the desktop app.

## Candidate future scopes

### Read-only public/community viewer

The narrowest option. It would expose only explicitly public metadata and channels under RLS, with no private messages, uploads, voice or account administration.

### Lightweight authenticated companion

Could include mentions, text chat and basic notifications while excluding desktop-native services, screen sharing and complex administration.

### Full web parity

Highest cost and risk. Requires browser replacements for native services, comprehensive lifecycle/permission QA and simultaneous client compatibility. It is not recommended as the first web milestone.

No option is selected today.

## Approval gates

Web implementation may start only after:

- A validated browser-specific user need and approved scope/exclusions.
- Hosted Supabase RLS, Storage and Edge Function authorization tests.
- Production CSP, CORS, attachment-delivery and secret-scanning review.
- Browser auth/callback, session-revocation and shared-device privacy design.
- LiveKit browser lifecycle and permission proof of concept if voice is included.
- Versioned API/realtime compatibility and deployment rollback strategy.
- Supported browser matrix, accessibility QA and named support ownership.
- Separate product, security and operations Go/No-Go approval.

## Recommended discovery sequence

1. Validate whether users need read-only, companion or full web access.
2. Define explicit feature and data exclusions.
3. Threat-model the public origin and complete hosted RLS/Storage tests.
4. Prototype auth callbacks, realtime reconnect and private attachment access on a temporary non-production origin.
5. Measure bundle/startup behavior and browser compatibility.
6. Produce a staffed estimate and Go/No-Go decision before changing production routes.

## Explicit non-goals today

- No public hosting of the Electron renderer.
- No mobile or web-first responsive redesign.
- No browser-specific production auth callback.
- No service worker/PWA/install prompt.
- No promise of feature parity.
- No weakening of desktop packaging or Electron-native behavior.

## Reassessment trigger

Reassess only when a measurable browser use case, approved budget, security owner, hosted backend certification and release/support plan exist. Until then, Electron artifacts remain the only supported Picom client distribution.

