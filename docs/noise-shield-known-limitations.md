# Noise Shield known limitations

## Current release limitations

1. **Enhanced provider unavailable.** The optional official LiveKit processor package/runtime is not installed or configured. Enhanced remains disabled or resolves to Standard fallback with a specific error code.
2. **Voice Focus provider unavailable.** Voice Focus uses the same conditional provider boundary, is never default, and cannot be certified until a provider supports the mode in the target runtime.
3. **No native acoustic certification yet.** The repeatable fan, keyboard, HVAC, background-speaker, echo, USB/laptop/Bluetooth microphone, quiet-room, and transient matrix has not been recorded on Windows, Linux, or macOS.
4. **No hosted two-client evidence yet.** A protected LiveKit staging room and two controlled clients were not available. Local state/reconnect/token contracts do not substitute for audible hosted evidence.
5. **Sustained CPU and memory soak not recorded.** Renderer diagnostics intentionally avoid pretending that browser-managed processing cost is precise CPU telemetry. Use the documented OS-level protocol.
6. **Repository-wide memory audit has an unrelated blocker.** `memory:leak:extended:audit` stops at the existing Direct Messages assertion `DM realtime cleanup is missing canceled = true`. Noise Shield's dedicated lifecycle/leak tests pass, but the global failure remains a project release risk.
7. **Bundle warnings remain below hard caps.** Initial CSS and total assets remain warning-level technical debt even though the performance gate passes. Noise Shield's provider code remains lazy.

## Expected user behavior

- Standard is the safe default when supported.
- If native suppression is unavailable, Picom keeps a basic microphone path and explains the fallback.
- Selecting an unavailable Enhanced/Voice Focus mode never produces a false active badge.
- Device removal falls back once to an available/default input and does not create an automatic permission-prompt loop.
- Voice Focus warns that intended nearby speakers may be suppressed and that it is unsuitable for music/studio input.

## Certification needed before enabling optional modes

- Add and license the official supported processor package/provider.
- Verify runtime/browser/provider support against the Electron version used by each release.
- Run the full native acoustic matrix and 15/30-minute CPU/memory protocols on Windows, Linux, and macOS.
- Run protected two-client LiveKit mode-switch, reconnect, fallback, and intelligibility tests.
- Record provider/model load failures and offline/cache behavior without bundling credentials or models incorrectly.
- Obtain release approval before changing Enhanced/Voice Focus availability from conditional/blocked.
