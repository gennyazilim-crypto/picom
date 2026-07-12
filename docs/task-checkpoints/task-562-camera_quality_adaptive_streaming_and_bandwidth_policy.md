# Task 562 - Camera Quality Adaptive Streaming and Bandwidth Policy

## Status

Implemented. Hosted/native bandwidth evidence remains blocked.

## Delivered

- Added Data Saver, Balanced, and High Quality camera presets using LiveKit `VideoPresets`.
- Enabled explicit simulcast publishing, adaptive stream background pausing, and dynacast.
- Added tile-size quality hints for grid, speaker focus, filmstrip, and stage layouts.
- Unsubscribed hidden/paginated camera publications and requested appropriate visible layers.
- Limited stage viewer subscriptions to stage camera tracks.
- Applied connection-quality video caps while leaving audio subscriptions independent.
- Exposed the policy through the existing meeting/LiveKit service boundary.

## Validation

- PASS: `node scripts/meeting-adaptive-media-quality-smoke.mjs`
- PASS: `npm run typecheck`
- PASS: `npm run mock:smoke`
- PASS: `npm run build`
- PASS: `npm run performance:budget:ci`
  - initial JS remained `1183.9 KiB`; no initial graph regression.
  - adaptive policy remains in the meeting/voice lazy graph.
  - initial CSS `235.1 KiB` and total assets `3325.9 KiB` remain below hard caps, with existing warning exceptions.
- PASS: `npm run qa:smoke`

## Blocked evidence

- Hosted LiveKit multi-client congestion shaping: **BLOCKED**, staging provider unavailable.
- Native CPU/network measurements on Windows, Linux, and macOS: **BLOCKED**, requires platform hardware sessions.
