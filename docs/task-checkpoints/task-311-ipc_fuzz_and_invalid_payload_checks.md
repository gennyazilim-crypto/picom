# Task 311 - IPC fuzz and invalid payload checks

## Result

- Main Electron handlers now consume a shared pure IPC payload-validation module.
- Added deterministic invalid-type/protocol/length/path/deep-link fuzz coverage with 1,000 generated string cases.
- Window controls and tray accept exact enum values only.
- External links accept HTTP/HTTPS only and reject embedded credentials, file/data/javascript/picom/shell protocols, malformed and oversized URLs.
- Notification, save-text, and clipboard payloads enforce type/size bounds; save filenames remove path/reserved characters and arbitrary paths are ignored.
- Screen picker remains sender-guarded with fixed `screen`/`window` source types and no renderer options.
- Update IPC remains intentionally absent from frozen preload contract version 1.
- No shell command, arbitrary filesystem read/list/delete, or raw native object was added.

## Validation

- `npm run electron:ipc-fuzz:test`
- `npm run electron:preload-contract:test`
- `npm run renderer:native:smoke`
- `npm run electron:security:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Manual IPC check

The deterministic test uses synthetic values only and invokes pure validators, never native effects. A packaged development harness may additionally invoke invalid payloads through the frozen bridge and must confirm safe error results, no dialog/shell/file side effect, no crash, and no listener accumulation.
