# Task 116 Checkpoint: Support Center and Help Docs

## Result

Added a local searchable Help Center to Picom Settings and documented its user-support content and maintenance boundaries.

## Included topics

- Getting started
- Joining communities
- Sending messages and images
- Mention Feed
- Profiles
- Voice and screen share
- Privacy and safety
- Troubleshooting
- Exporting redacted diagnostics

## Integration

- Entry point: `Settings > Help Center`
- Content is static/local and works without internet.
- Search remains in renderer memory and is not sent to a provider.
- Existing Diagnostics and Privacy & Safety support entry points are documented.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

