# Root Dashboard UI Discovery (Task 01)

## Goal

Owner-only Picom management dashboard UI that reuses Picom charcoal/cool-gray + teal language, is permission-aware, and never presents fabricated metrics.

Visual / IA reference: [Astral Engine Enterprise Dashboard](https://lightswind.com/templates/astral-admin) (see `ASTRAL_ADMIN_REFERENCE.md`).

Root bootstrap account: `f.tayboga@gmail.com` (server-side `app_admin` / RLS remains authority).

## Existing surfaces audited

| Area | Location | Notes |
|------|----------|-------|
| Global sidebar | `GlobalAppSidebar.tsx` | No Panel entry yet |
| Admin Operations | `AdminOperationsPanel.tsx` | Settings nest; fail-closed |
| Tokens | `styles.css` | `--surface`, `--accent`, `--warning` |
| Charts / table kit | — | Built under `rootDashboard/` |

## Information architecture

Panel → Shell → Overview + domain modules (Users, Communities, Support, Security, Ads, Revenue, Radio, Podcast, Health, Incidents, Roles, Audit, Flags, Reports, Settings, Command Center).

## Implementation order

01 Discovery → 02 Panel entry → 03 Shell → 04 Nav → 05 Overview → 06–09 primitives → 10–35 modules → 36–40 polish/audit.
