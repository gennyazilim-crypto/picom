# Plugin Sandbox Prototype Plan

## Status and non-goal

Picom has no plugin runtime and this task does not add one. No dynamic import, downloaded JavaScript, `eval`, Node `vm`, WebView execution, native module, shell command, or filesystem loader is introduced. This plan defines the evidence required before an isolated research prototype could exist.

The preferred path for most integrations remains a versioned remote Bot API or webhook, because server-side scope enforcement and revocation are safer than desktop code execution.

## Safe extension points

A prototype may expose declarative, bounded contributions only:

- slash-command metadata routed to reviewed remote handlers;
- context-menu items with fixed host actions;
- read-only sidebar/status cards using host-rendered schemas;
- settings fields for non-secret plugin preferences;
- notifications requested through a permission-checked host capability;
- theme-neutral icons from an approved packaged asset subset.

Plugins cannot replace the titlebar, auth, message renderer/composer, moderation warnings, permissions UI, updater, security dialogs, or trusted settings. UI is rendered by Picom components from validated data; no plugin HTML/CSS/script is injected.

## Isolation architecture

Research must compare an out-of-process capability worker and a hardened sandboxed utility process. A renderer iframe/WebView and Node `vm` alone are not accepted isolation boundaries. The plugin process has no inherited environment, user session, Node/Electron API, preload bridge, DOM, Chromium cookies/storage, native handles, filesystem path, shell, clipboard, camera/microphone/screen, network socket, service-role credential, or LiveKit token.

All communication uses a versioned structured-clone schema over a narrow broker. The host validates message type, size, rate, timeout, origin/plugin identity, request ID, and capability grant. Unknown messages fail closed. The process has CPU, memory, execution-time, queue, output-size, and restart limits and can be terminated independently without crashing chat.

## Capability permissions

Permissions are deny-by-default, per plugin, version, user, community, and extension point. Potential grants are granular, such as `ui:sidebar-card`, `commands:contribute`, `notifications:request`, or `messages:send-via-bot`. There is no generic `network`, `filesystem`, `electron`, `node`, `database`, `execute`, or `read-all-messages` permission.

Private-channel and user data is never passed merely because a UI contribution is visible. Any data action routes through backend/RLS and the plugin's approved bot identity. Permission expansion, ownership change, and plugin update require re-consent/review. Users/admins can disable or uninstall immediately.

## Packaging and signing

Prototype packages use a deterministic manifest, content hashes, Picom API compatibility range, publisher ID, version, declared capabilities, extension-point schemas, and signature metadata. Only signatures from a development trust store are accepted in research builds. Production trust roots, key rotation/revocation, transparency/receipt, reproducible package checks, and rollback require separate security design.

Unsigned local development is allowed only in an unmistakable development build with explicit launch configuration, warning UI, isolated sample data, and no production account/session. Production builds do not expose a sideload switch.

## Review process

1. Automated manifest/schema, dependency, malware, secret, and prohibited-capability checks.
2. Source and build provenance review.
3. Manual security/privacy/accessibility/UI review.
4. Permission minimization and data-flow review.
5. Adversarial sandbox escape, IPC fuzz, resource exhaustion, update/downgrade, and signature tests.
6. Limited internal allowlist with monitoring and emergency revocation.

Approval is version-specific. Obfuscated code, remote code loading, self-updating assets, dynamic dependency download, hidden telemetry, credential collection, ads/dark patterns, impersonation, or attempts to bypass the broker are prohibited.

## Host safeguards

- `contextIsolation: true`, `nodeIntegration: false`, and existing preload channel allowlists remain unchanged.
- Plugin broker lives outside React components and never exposes raw Electron objects.
- CSP forbids injected/evaluated code and unapproved network/frame sources.
- Output is escaped and host-rendered; unsafe HTML is never accepted.
- Logging contains bounded plugin IDs/result codes only, never secrets or private content.
- Crash loop detection quarantines the plugin; safe mode starts with all plugins disabled.
- Emergency revocation disables packages independently of feature visibility.

## Prototype phases

1. Threat model and capability schema with no code execution.
2. Host-rendered static manifest fixture in a dedicated development build.
3. Out-of-process deterministic sample capability using synthetic data only.
4. IPC/resource/sandbox adversarial test harness.
5. Signed internal package and revocation drill.
6. Independent security review and explicit go/no-go.

Each phase may be abandoned in favor of remote bots/webhooks if isolation assurance or maintenance cost is unacceptable.

## Prototype limitations

The prototype cannot prove perfect sandboxing across Electron/Chromium/OS vulnerabilities. It will not support arbitrary UI, Node packages, local files, direct network, offline execution against real user data, native extensions, public marketplace, monetization, auto-update, or production sideloading. Windows, Linux, and macOS process/sandbox behavior require separate validation.

## Exit criteria

No runtime work begins until the threat model, capability list, process boundary, signing lifecycle, CSP/IPC impact, safe-mode/recovery, cross-platform tests, review staffing, incident response, and long-term patch commitment are approved. A failed escape or private-data test is an immediate no-go.
