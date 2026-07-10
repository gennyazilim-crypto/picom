# Task 356 checkpoint: Cross-platform screen share certification

## Result

- Local preload/IPC/permission/preview/stop contracts: **Passed**.
- Real remote-view and Windows packaged check: **Pending**.
- Linux/macOS certification: **Blocked**.

## Commands

- `npm run screen-share:recovery:test`
- `npm run screen-share:preview:test`
- `npm run electron:preload-contract:test`
- `npm run renderer:native:smoke`
- `npm run electron:ipc-fuzz:test`
- `npm run livekit:smoke`

No raw Electron API was added to React and no capture was initiated by this task.
