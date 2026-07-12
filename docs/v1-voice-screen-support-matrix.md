# Picom V1 Voice and Screen Share Support Matrix

Decision: **INCLUDED**
Stable platform claim: Windows

| Capability | Active community member | Visitor/non-member/restricted | Evidence |
| --- | --- | --- | --- |
| Discover and join Voice Room | Supported | Denied | Hosted run 29197503222 |
| Publish microphone audio | Supported after explicit permission | Denied | Hosted and packaged Windows |
| Receive remote audio | Supported | Denied | Hosted and packaged Windows |
| Share a screen/window | Supported after explicit source selection | Denied | Windows run 29198913461 |
| Multiple simultaneous shares | Four publishers certified | Denied | Hosted and packaged Windows |
| Remote share rendering/switching | Supported | Denied | Hosted and packaged Windows |
| Reconnect and media recovery | Supported | Not applicable | Runs 29197503222 and 29199409039 |
| Mute/remove/end moderation | Role hierarchy only | Denied | Authorization/implementation contract |
| No raw media storage | Required | Required | Security run 29199409039 |

## Certified environment

The packaged test covered Windows Server 2025, x64, one monitor at 100-percent scale, and a controlled Chromium microphone. Physical microphone hardware, multi-monitor, 125/150-percent DPI, trusted signing, and fresh provider moderation execution remain explicit release-lab limitations.

## Operational requirements

Production requires protected LiveKit/Supabase secret custody, approved capacity/region ownership, signature-verified webhook configuration, monitoring, incident ownership, and emergency kill-switch access.
