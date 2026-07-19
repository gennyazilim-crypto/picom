# Feed, DM and Community performance results

## Source-level improvement

The Feed service no longer statically imports mock mention datasets in production entry modules. Mock data is loaded only when mock mode executes.

## Required local measurements

- Production build and renderer performance budget.
- Feed first page, next page and 1k/10k item scroll memory.
- DM 10k-message history pagination and reaction/attachment updates.
- Community 1k-member list and long channel tree.
- Realtime reconnect burst, dedupe count and cache refresh count.

## Evidence policy

Measurements from commands run after this document is created are reported in the task completion response. Large-data, GPU, memory and native package measurements remain unverified until their dedicated fixtures/runners execute. No estimated number is treated as a pass.

## Final renderer measurement - 2026-07-19

- Baseline initial JavaScript: 2046.0 KiB.
- Final initial JavaScript: 1286.6 KiB (below the 1650.0 KiB hard cap; above the 1200.0 KiB preferred target).
- Baseline initial CSS: 357.9 KiB.
- Final initial CSS: 319.1 KiB (passes the 322.0 KiB target).
- Baseline largest image: 1626.7 KiB.
- Final largest image: 29.5 KiB (passes the 768.0 KiB target).
- Baseline total assets: 6858.2 KiB.
- Final total assets: 3795.8 KiB.
- Generated assets: 144.
- Largest JS chunk: 972.7 KiB; largest CSS chunk: 318.2 KiB.

The initial graph was reduced by deferring LiveKit runtime loading, deferring closed overlay components, replacing the animation runtime with a small native adapter, and serving optimized WebP brand assets. No budget was raised or bypassed. `npm run performance:budget:ci` still exits non-zero because total assets exceed the 3700.0 KiB hard cap by 95.7 KiB. Stable release remains blocked until that last regression is removed or a separately approved budget-governance decision is recorded.
