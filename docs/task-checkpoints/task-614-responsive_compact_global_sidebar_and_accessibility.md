# Task 614 - Responsive Compact Global Sidebar and Accessibility

## Result

- The authenticated global sidebar keeps the 216 px wide desktop layout and switches to the existing 72 px compact layout at 1320 px.
- The responsive state now drives React labels, native compact tooltips, badges, presence controls, and the current-user card.
- Native buttons preserve Tab, Enter, and Space behavior; Arrow Up/Down plus Home/End move focus across global destinations.
- Active destinations expose `aria-current`, unavailable destinations expose `aria-disabled`, and notification/presence values have text labels.
- Presence closes on Escape and restores focus to its trigger. Focus-visible and reduced-motion behavior remain explicit.
- No mobile or bottom navigation was introduced. At 1024 px the existing minimum-desktop warning remains the approved behavior.

## Desktop QA matrix

| Scenario | Expected result |
| --- | --- |
| 1440 px at 100/125/150% | Wide when space permits; labels truncate without horizontal overflow. |
| 1280 px at 100/125/150% | Compact icon-only navigation with titles, badges, utilities, and user controls. |
| Approved 1100 px minimum | Compact navigation and usable community columns. |
| 1024 px | Existing desktop-optimized warning; no mobile fallback. |
| Long Turkish labels | Accessible name remains complete; visible label truncation does not resize the shell. |

## Evidence

- `node scripts/global-sidebar-responsive-accessibility-smoke.mjs`
- `node scripts/global-navigation-shell-smoke.mjs`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run visual:regression:contract`
- `npm run e2e:coverage:contract`
- `npm run performance:budget:ci`

Manual assistive-technology certification across Windows Narrator, macOS VoiceOver, and Linux Orca remains a release QA activity and is not represented as automated evidence.
