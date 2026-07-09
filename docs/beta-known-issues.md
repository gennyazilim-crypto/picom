# Picom Beta Known Issues

This list describes current beta limitations. It must not be interpreted as a production-readiness claim.

## Packaging and installation

| Issue | Impact | Workaround / status |
| --- | --- | --- |
| Stale Picom Vite/Electron processes can lock electron-builder output and cause `EPERM` | Packaging stops before the installer is produced | Resolved for the current candidate by closing project-specific processes and clearing only incomplete `.tmp` output before rebuilding |
| Local beta artifacts are unsigned | Windows SmartScreen or macOS Gatekeeper may warn | Use approved internal artifacts; signing/notarization is a later release gate |
| Linux and macOS artifacts cannot be validated from Windows | Cross-platform package quality remains unconfirmed | Build and smoke-test on native Linux/macOS hosts or dedicated CI runners |
| Vite reports chunks over 500 kB | Startup/download performance may be lower than target | Non-blocking for this beta; code splitting remains a tracked optimization |

## Supabase staging

| Issue | Impact | Workaround / status |
| --- | --- | --- |
| Supabase CLI is not installed on every development machine | Local migration/type commands cannot run there | Install the CLI on the staging operator machine and follow the staging runbook |
| Connected beta depends on staging environment values | Auth/data screens may fall back or fail when staging is not configured | Use the documented local `.env` template; never use service-role keys in the renderer |
| OAuth requires provider and redirect configuration | Google/Apple sign-in fails if provider settings are incomplete | Configure provider credentials and `picom://auth/callback` in Supabase before testing |
| RLS behavior requires live staging verification | Static smoke checks cannot prove deployed policy behavior | Run owner/member/visitor/private-channel tests against staging before distribution |

## LiveKit and screen sharing

| Issue | Impact | Workaround / status |
| --- | --- | --- |
| Voice requires LiveKit staging and a deployed token function | Voice join fails without a valid endpoint/token | Follow the LiveKit staging setup and test with two clients |
| Screen sharing depends on OS capture permissions | Picker/track publication may fail or show no sources | Grant only the requested screen-recording permission and restart Picom if required |
| macOS microphone and screen-recording permissions require native QA | Permission recovery behavior is not proven from Windows | Test denial, approval, and re-approval on supported macOS hardware |
| Linux capture behavior varies by desktop session/portal | Wayland/PipeWire combinations may present different sources | Record distro/session details and test the target package natively |
| Audio/screen quality under poor networks is beta quality | Reconnect or track quality may degrade | Capture redacted diagnostics and network conditions in reports |

## Beta behavior boundaries

- Feed social state such as story seen state and some follow/save/read interactions can remain local in mock mode.
- Mock mode does not prove Supabase RLS, Storage, Realtime, or LiveKit behavior.
- Native notifications, tray behavior, microphone, screen capture, and protocol callbacks require packaged/native smoke testing.
- No mobile UI is supported.
- Bot marketplace, production webhooks, plugins, enterprise features, SSO/SCIM, billing, public discovery, production auto-update, and production E2EE are intentionally excluded.

## Reporting a new known issue

Create a beta report with severity, platform, app version, mode, reproduction steps, expected result, actual result, and redacted diagnostics. Security or private-channel isolation concerns must be treated as release blockers and escalated immediately.
