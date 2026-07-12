# Task 556 Checkpoint - Participant Context Menu and Local Controls

## Delivered

- Central participant menu for all reusable meeting tiles and the fallback stage layout.
- View Profile, Send Message, Pin/Unpin, local volume, Mute locally, Report, and self device/view controls.
- Server-authorized mute, remove, screen-share stop, and hierarchy-safe stage promotion/demotion.
- Existing `ReportModal`, profile navigation, direct-message navigation, stage service, and LiveKit moderation boundaries reused.
- Viewport clamping, focus restoration, Escape, arrow keys, visible focus states, and explicit local-versus-global mute copy.

## Security

- UI capability checks are UX only.
- Supabase RPC validates JWT, active room/session/participant, non-self target, and participant hierarchy.
- Edge Function resolves canonical provider room/identity after authorization and writes an audit record.
- Local controls never call moderator RPCs or alter remote publication state for other clients.

## Validation

- `node scripts/meeting-participant-context-menu-smoke.mjs`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run performance:budget:ci`
- `npm run qa:smoke`

The tracked `picom-logo-concept.png` was losslessly re-encoded during budget validation. Dimensions and decoded pixel hash were verified identical; the file decreased from 752,197 to 519,367 bytes so the new meeting controls do not consume the renderer total-assets headroom.

Hosted Supabase pgTAP and real LiveKit provider moderation remain blocked until the release environment and credentials are available; no hosted pass is claimed.
