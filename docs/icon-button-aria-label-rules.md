# Icon button aria-label rules

Task 059 defines the accessibility rule for Picom MVP icon buttons.

## Rule

Every icon-only interactive button must include a clear `aria-label` on the button element.

## Examples

Good:

```tsx
<button className="icon-button" aria-label="Open settings">
  <AppIcon name="settings" />
</button>
```

Also good when the button has visible text:

```tsx
<button className="send-button">
  <AppIcon name="send" /> Send
</button>
```

## AppIcon behavior

- `AppIcon` is decorative by default and uses `aria-hidden`.
- Prefer labeling the button, not the SVG, for icon-only controls.
- Use `ariaLabel` on `AppIcon` only when the SVG itself is the semantic image.

## Current audit result

A source scan found the MVP shell icon-only controls have labels in these areas:

- WindowTitleBar window controls
- ServerRail utility buttons
- CommunitySidebar community/menu and UserMiniCard controls
- ChatHeader action buttons
- MessageComposer icon buttons
- Message avatar/profile buttons
- Settings and image preview close buttons

## Ongoing requirement

Any future icon-only button added to Picom must include `aria-label` before merge.