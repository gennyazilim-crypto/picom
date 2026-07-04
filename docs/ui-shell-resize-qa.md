# UI shell resize QA

Task 045 verifies the Picom desktop shell resize expectations for the MVP UI.

## Desktop resize targets

- Default design target: 1440x900.
- Minimum usable shell width: 1100px.
- Minimum usable shell height: 700px.
- Below 1100px width, the desktop warning is shown instead of a mobile layout.

## QA checklist

- The WindowTitleBar remains fixed at the top.
- ServerRail remains fixed at 72px.
- CommunitySidebar remains fixed at 260px.
- ChatMain flexes without forcing horizontal overflow.
- MemberSidebar remains fixed at 280px when visible.
- MessageList scrolls independently.
- Community channel list scrolls independently.
- Member list scrolls independently.
- MessageComposer remains pinned at the bottom.
- Settings modal stays inside the viewport.
- Image preview stays inside the viewport.
- Light and dark mode both keep the rounded shell intact.
- No mobile navigation or web-first responsive layout appears.

## Manual test steps

1. Run `npm run dev`.
2. Test at 1440x900.
3. Resize toward 1100px width and confirm no horizontal scrollbar appears.
4. Resize below 1100px and confirm the desktop warning appears.
5. Toggle the member sidebar and confirm ChatMain reflows without page-level overflow.
6. Send a message and confirm the composer remains pinned.
7. Switch light/dark themes and repeat the shell check.

## Result placeholder

Automated type/build verification is recorded in the task checkpoint. Manual visual resize QA should be performed in Electron dev mode on the local machine.