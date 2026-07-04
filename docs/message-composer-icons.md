# MessageComposer icon mapping

Task 056 confirms MessageComposer icons are rendered through `AppIcon` and backed by the MVP semantic icon map.

## Mapped icons

- Attach: `messageComposer.attach`
- Emoji: `messageComposer.emoji`
- Send: `messageComposer.send`
- Image/drop hint: `messageComposer.image`
- Remove preview: `messageComposer.close`

## Accessibility

Composer icon-only buttons keep explicit `aria-label` values. The send button includes visible text, so its icon remains decorative.