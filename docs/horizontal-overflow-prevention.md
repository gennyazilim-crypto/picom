# Horizontal overflow prevention

Task 039 adds guardrails so Picom keeps a stable desktop shell without page-level horizontal scrolling.

## Guardrails

- Root and shell containers hide page-level horizontal overflow.
- Flex/grid children use `min-width: 0` where text or content could otherwise force columns wider.
- Long labels and message text truncate or wrap safely.
- Images, attachment grids, modals, and preview surfaces are capped to the viewport.
- Fixed desktop columns remain fixed; this does not introduce a mobile layout.

## Manual verification

- Launch at 1440x900 and confirm the four columns are stable.
- Test long channel/member/message text.
- Open settings and image preview.
- Confirm no page-level horizontal scrollbar appears.