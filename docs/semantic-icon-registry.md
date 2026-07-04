# Semantic icon registry

Task 050 creates a typed semantic registry for the MVP icon system.

## Purpose

The registry maps product concepts to approved `AppIcon` names. This keeps future UI code from choosing random icons ad hoc.

Examples:

- `textChannel` -> `hash`
- `voiceChannel` -> `voice`
- `sendMessage` -> `send`
- `attachFile` -> `paperclip`
- `darkTheme` -> `moon`

## Rules

- Registry values must be valid `IconName` values.
- New values must still come from the free Coolicons source policy.
- Components may keep direct `AppIcon` usage for now; future cleanup can migrate them to semantic names safely.
- The registry is not a second icon system. It is only a typed map over `AppIcon`.