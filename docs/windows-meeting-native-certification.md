# Windows Meeting Native Certification

## Certification boundary

Picom currently packages a Windows x64 NSIS installer. Task 578 therefore certifies only Windows x64; it does not claim ARM64 support. Certification must use one exact trusted, timestamped candidate on a clean or controlled Windows 10/11 machine and a distinct remote meeting client.

The committed evidence is `BLOCKED`. Existing source, IPC, package, and screen-share contracts are valuable preflight evidence, but they do not prove native devices, installer behavior, or remote screen rendering.

## Required inventory

Record only redacted, non-serial hardware descriptions:

- Windows edition/build and x64 architecture;
- display scaling percentage and monitor count;
- camera, microphone, speaker, and GPU model families;
- exact installer file name, application version, SHA-256, publisher verification, and trusted timestamp;
- remote client platform and confirmation that it is a distinct client.

Do not record host names, account identifiers, device serial numbers, private room names, tokens, screen content, audio, or raw media.

## Execution

1. Obtain the signed artifact from the protected Windows signing workflow.
2. Compute SHA-256 after signing and record it before installation.
3. Verify the Authenticode publisher and timestamp on the controlled machine.
4. Install the exact candidate and complete every flow in `tests/native/windows-meeting-certification-matrix.json`.
5. Use a distinct remote client for voice, camera, screen/window share, grid/focus, signaling, waiting-room, reconnect, mini meeting, and leave/end checks.
6. Capture redacted UI state only. Do not retain screen frames, source thumbnails, microphone recordings, access details, or private content.
7. Confirm remote rendering for both an entire-screen source and a window source, then verify stop, OS-ended, reconnect, leave, and uninstall cleanup.
8. Uninstall and reinstall the same hash to verify deterministic first-launch and settings behavior.
9. Place redacted evidence under `docs/evidence/task-578/` and populate a separate evidence JSON matching `docs/evidence/task-578-windows-meeting.json`.
10. Run on the controlled Windows machine:

   `set PICOM_WINDOWS_MEETING_CONFIRM=CONTROLLED_WINDOWS_ONLY`

   `set PICOM_WINDOWS_EXPECTED_PUBLISHER=<approved publisher subject>`

   `node scripts/windows-meeting-native-certification.mjs --run --artifact <signed-installer.exe> --evidence <redacted-evidence.json>`

The validator recomputes the candidate hash, requires all 22 real flow results and evidence references, executes current Electron/meeting/screen-share contracts, and invokes the fail-closed Authenticode verifier. It never installs, uninstalls, grants permissions, or captures media automatically.

## Pass criteria

- The exact signed/timestamped candidate installs, first-launch setup completes, and custom window controls/focus mode work.
- Microphone, camera, and speaker permissions and device switches recover without duplicate tracks.
- Noise Shield, voice, camera, grid/focus, chat, reactions, hand, waiting room, and mini meeting work with the remote client.
- Screen and window sources render remotely and stop without ghost tracks.
- Network reconnect, leave/end, uninstall, and reinstall complete without stale sessions or media.
- Every artifact is redacted and contains no private data or raw media.

Until this matrix passes, RB-04, RB-05, and RB-06 remain open.
