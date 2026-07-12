# Noise Shield UI Contract

## Settings: Voice and Video

The existing Voice settings surface now includes a Noise Shield section before device controls.

- Four modes are named: Off, Standard, Enhanced, Voice Focus.
- Only runtime/provider-supported modes are selectable.
- Enhanced and Voice Focus stay disabled with an exact provider/package explanation in this build.
- Echo cancellation and automatic gain are independent controls.
- Remember-for-device stores only local preference metadata.
- Requested and applied modes are displayed separately.
- Permission, no-device, loading, failure, unavailable, and Standard fallback copy is explicit.
- Retry appears only for meaningful recoverable states and is disabled without microphone permission.

The existing explicit microphone meter is reused. It starts only after user action, processes levels in memory, and stops on settings cleanup.

## Voice Room quick control

The voice-room controls include a compact labeled selector that shows:

- applied Shield mode;
- loading/fallback status;
- independent echo state;
- only currently available mode options.

Changing a mode updates local preference and reapplies the existing microphone track only when connected and unmuted.

## Connected Voice and Meeting mini state

The Feed Connected Voice card and cross-app Meeting mini card show compact `Shield:` state. Their icon uses Picom's voice-wave AppIcon plus an explicit text label, so it cannot be mistaken for an account verification or generic security badge.

Fallback is rendered as `Shield: Standard fallback`, not as Enhanced/Voice Focus active.

## Accessibility

- Mode selection uses a labeled radiogroup and `aria-checked`.
- Quick controls have explicit labels and native select semantics.
- Status is announced through a polite status region and never depends on color alone.
- Disabled modes retain exact explanations.
- Focus-visible rings use the Picom focus token.
- Reduced-motion disables component animation/transition behavior.
- Light and dark modes inherit semantic surface, border, text, accent, warning, and focus tokens.

## Isolation

All copy states that processing is microphone-only. No UI action routes to Radio, Podcast, music, screen-share system audio, or an audio player.

