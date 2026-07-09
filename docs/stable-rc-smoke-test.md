# Picom Stable RC Smoke Test

Use one evidence record per exact artifact/platform. Mark `Not run` rather than inferring a pass from another host.

## Candidate identity

- Version:
- Release channel:
- Source commit:
- Migration/function versions:
- Platform/architecture:
- Artifact filename/bytes/SHA-256:
- Signature/notarization/provenance:
- Tester/date/environment:

## Source gates

- [ ] Clean checkout and `npm ci`.
- [ ] `npm run env:placeholders:check`.
- [ ] `npm run qa:smoke`.
- [ ] `npm run qa:supabase`.
- [ ] `npm run typecheck`.
- [ ] `npm run mock:smoke`.
- [ ] `npm run build`.
- [ ] Dependency/license/secret/package verification.
- [ ] Known issues and blocker triage reviewed.

## Supabase staging

- [ ] Production migration set applies from previous-release staging schema.
- [ ] Real pgTAP and owner/admin/moderator/member/visitor matrix pass.
- [ ] Auth register/login/verify/reset/session restore pass.
- [ ] Community/channel/message/reaction flows pass.
- [ ] Private channel/message/attachment and Mention Feed isolation pass.
- [ ] Private Storage MIME/size/path/signed URL refresh/access-loss pass.
- [ ] Realtime two-window insert/update/delete/reconnect/cleanup/duplicate prevention pass.
- [ ] Required Edge Functions enforce JWT/resource permissions/redacted errors.

## LiveKit staging

- [ ] Two users join one permitted room with correct identity/room/TTL.
- [ ] Unauthorized/text/mismatched room requests are denied.
- [ ] Mute/unmute, deafen/undeafen, speaking, participant state pass.
- [ ] Source picker, local/remote share, stop/leave cleanup pass.
- [ ] Network reconnect/degraded text chat behavior pass.
- [ ] No token, device, audio, or screen content appears in logs.

## Windows artifact

- [ ] Signed/timestamped stable artifact verifies as Valid.
- [ ] Clean install, prior-version upgrade, launch, protocol, uninstall, reinstall/rollback pass.
- [ ] Custom titlebar/window controls/normal-maximized frame pass.
- [ ] Auth, chat, Settings/diagnostics, voice/share smoke pass.

## Linux artifacts

- [ ] Native AppImage and deb build and content inspection pass.
- [ ] Terminal and desktop menu launch pass.
- [ ] Install/upgrade/uninstall/reinstall pass for deb.
- [ ] Approved distro X11/Wayland microphone/share/tray/notification checks pass.

## macOS artifacts

- [ ] Native dmg and zip build pass for approved architecture.
- [ ] Developer ID signature, hardened runtime, notarization, staple, Gatekeeper pass.
- [ ] Clean install/upgrade/remove/reinstall/rollback pass.
- [ ] Final bundle microphone/Screen Recording denial/grant/restart pass.

## Legal/privacy/support

- [ ] `docs/legal-release-checklist.md` approved.
- [ ] Terms/Privacy versions and consent record behavior approved.
- [ ] Third-party notices/licenses/artwork rights approved.
- [ ] Feedback, diagnostics, status, support, incident, rollback owners ready.
- [ ] Backup/restore drill evidence accepted.

## Result

- [ ] PASS - eligible for go/no-go review, not automatically published.
- [ ] FAIL - defect evidence linked.
- [ ] BLOCKED - missing external/sign-off evidence linked.

Current repository result for `0.1.1-beta.1`: **BLOCKED**.
