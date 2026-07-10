# Auto-Update Beta Channel Foundation

Picom supports `dev`, `beta`, and `stable` release-channel metadata. The current implementation is a deterministic local state machine for UI and recovery testing only.

## States

`idle`, `checking`, `available`, `downloading`, `download_failed`, `ready_to_install`, `install_failed`, `up_to_date`, and `error` are represented by `updateService`. A compatibility-only rollback placeholder remains documented but performs no package change.

## Security boundary

- No production update endpoint is hardcoded.
- No signing certificate, private key, updater token, or publishing credential is present in the repository or renderer.
- `autoUpdateEnabled` remains false.
- Electron updater integration must be implemented in the main process with a minimal preload bridge after artifact signing and rollback procedures are operational.
- Renderer simulation never downloads or installs a package.

## Beta rollout path

1. Sign Windows, Linux, and macOS artifacts through protected CI.
2. Publish channel-specific metadata and SHA256 checksums.
3. Verify staged beta rollout and rollback compatibility.
4. Add main-process download/install IPC with validated payloads.
5. Enable only after go/no-go approval.
