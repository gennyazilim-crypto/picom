# Startup performance final pass

## Result

Picom now applies the saved light/dark theme through a CSP-compatible early theme bootstrap before the renderer entry runs. Corrupted or unavailable local settings fail to the light theme, and forced Safe Mode also starts light. React remains the authority after hydration, so changing themes still updates the full desktop shell normally.

Optional services no longer execute before the first React render. Crash reporting and sleep/wake resume handling start during an idle callback with a bounded timeout; the safe native deep-link listener remains synchronous because it is a small routing primitive that must not miss a launch URL. Failure to initialize an optional service leaves the basic shell available and logs only a redacted warning.

Heavy, non-core surfaces are lazy loaded behind Suspense boundaries: Settings, first-run onboarding, Mention Feed, profiles, direct messages, saved messages, discovery and friends. Task 347 removed ChatMain's unreachable duplicate voice composition, so VoiceRoomView now also loads from App as a real deferred chunk. The community shell, titlebar, ServerRail, CommunitySidebar, text chat and auth screens remain on the immediate path so existing desktop interactions do not depend on a delayed chunk.

## Bundle warning review

The pre-pass renderer entry measured 1,672.31 kB uncompressed and 442.32 kB gzip. Lazy boundaries create independent chunks for optional views and reduce work on the immediate route, but Vite's 500 kB warning remains a tracked signal rather than being hidden with a larger warning threshold. Shared data, chat, permission, auth and service code still contributes to the entry bundle.

Do not add a heavy analyzer or arbitrary manual chunk map solely to silence the warning. Use `npm run build`, `npm run bundle:size`, and `npm run startup:performance:audit`; review the generated assets and verify that optional surfaces remain split. A future change must not pull Settings, voice UI or profile/gallery code back into the initial route.

## Packaged cold-start measurement

Structural optimization is complete, but packaged cold-start evidence is platform-specific and remains a release measurement:

1. Install signed-equivalent Windows, Linux and macOS candidate packages on representative lower/mid-range hardware.
2. Measure process launch to first visible titlebar/auth or community shell for ten cold runs.
3. Compare median and p95 with `docs/performance-budget.md` and record build hash, OS, storage type and Safe Mode state.
4. Open every deferred view once, then confirm Settings, Mention Feed, profile, DM, friends, discovery, saved messages and voice interactions still work.
5. Reject regressions that exceed the performance budget or introduce theme flash, blank routes, unhandled chunk failures or startup crashes.

The known ineffective `voiceService` dynamic-import warning is reviewed separately: Settings and diagnostics share voice state, so the service is still present in a shared chunk. Resolving that warning requires a focused service-boundary refactor and measured benefit; it is not hidden or treated as a functional failure here. Crash reporting also remains a shared module because the startup error boundary needs it; only provider initialization is deferred, which avoids claiming a bundle split that cannot occur.
