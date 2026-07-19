# Task 43 — Download Funnel

Measures the desktop-app acquisition funnel — landing → download → install → first launch →
activation — and update adoption (electron-updater), from aggregate step events + server logs.

## Architecture
```
web: page_view/download_click ──►┐
installer/updater: install, launch, update-applied ──► funnel rollup ──► download dashboard
app: first_launch/activation (Task 02) ──►┘
```

## Metrics
- Landing→download→install→launch→activation conversion, platform/arch split (Windows first),
  update-adoption rate + version distribution (from `PICOM_UPDATE_FEED_URL` feed hits),
  time-to-activation.

## Data & privacy
- Step counts + coarse platform/version only; **no device fingerprint**, no IP stored, no
  cross-site tracking. Web side uses privacy-first, consent-gated events. Version/update
  metrics are aggregate feed hits.

## Database / infra
- `download_funnel(step, platform, version, count, period)`; update adoption from feed logs.

## APIs / jobs
- Web + installer + app event rollups; update-adoption job over the generic update feed.

## Dashboard metrics
- Funnel conversion, install→activation, update adoption by version, stale-version share.

## Tests
- No fingerprint/IP; aggregate steps; version buckets; consent-gated on web.

## Validation checklist
- [ ] aggregate steps only · [ ] no fingerprint/IP · [ ] consented web events
- [ ] update adoption aggregate

## Risks / blockers
- Cross-surface stitching without identifiers is coarse → use aggregate rates, not
  user-joins. Ties to updater (electron-updater feed), Growth Analytics (19).

**Next:** Task 44 — Community Insights.
