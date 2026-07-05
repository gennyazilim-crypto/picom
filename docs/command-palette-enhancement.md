# Command Palette Enhancement

Task 286 adds small navigation/action enhancements to the existing command palette.

## Added commands

- Open mention feed
- Open direct messages
- Open friends foundation
- Create community

## Scope boundaries

This task does not add:

- New keyboard shortcuts
- Remote command registry
- Plugin commands
- Bot commands
- Mobile command UI

## Manual test steps

1. Run `npm run dev`.
2. Press `Ctrl+K`.
3. Search `mention`.
4. Run `Open mention feed`.
5. Press `Ctrl+K` again and run `Open direct messages`.
6. Press `Ctrl+K` again and run `Open friends foundation`.
7. Press `Ctrl+K` again and run `Create community`.
8. Confirm each command closes the palette and opens the expected desktop surface.
