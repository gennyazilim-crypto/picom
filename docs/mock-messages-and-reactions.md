# Mock messages and reactions

Task 065 separates mock message, attachment, and reaction generation from the community dataset.

## Runtime source

- `src/data/mockMessages.ts` owns mock message body text, generated attachment images, reaction placeholders, and per-community message assembly.
- `src/data/mockCommunities.ts` now calls `createMockMessagesForCommunity()`.

## Included message states

- Multi-author local message history
- Generated image attachments for 1, 2, 3, and 4-image grids
- Reaction placeholders
- Multiple populated text channels per community

## Guardrails

- Generated attachment images use Picom palette colors.
- No external image URL is required at runtime.
- No Discord branding or copied assets are used.