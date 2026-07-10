# Plugin System Security Design

## Status

Research/design only. Picom does not load, install, execute, or publish desktop plugins. No dynamic code loading or plugin runtime is added by this design.

## Goals

- Define whether narrowly scoped desktop extensions could ever be introduced safely.
- Keep Electron main, preload, renderer, Supabase, LiveKit, and user data boundaries explicit.
- Require least-privilege capabilities, review, signing, auditing, revocation, and safe updates before execution.
- Distinguish backend Bot API integrations from native desktop UI extensions.
- Preserve Picom's design system, accessibility, privacy, and cross-platform desktop stability.

## Non-goals

- No arbitrary JavaScript/TypeScript execution in the renderer.
- No `eval`, `new Function`, remote script tags, dynamic URL imports, or unpacked module loading.
- No shell, process, filesystem, registry, keychain, environment-variable, raw network socket, or native-module access.
- No direct Electron, preload, IPC, Supabase service role, LiveKit secret, updater, signing, or operating-system API access.
- No plugin marketplace, public publishing, sideloading, or developer mode installer.
- No ability to modify Picom source, CSP, RLS, permissions, titlebar, or security settings.
- No claim that a secure sandbox has been selected or implemented.

## Threat model

Desktop plugins introduce a high-impact supply-chain and local-code execution boundary. Important threats include:

- Malicious or compromised plugin package.
- Maintainer account/signing-key compromise.
- Dependency confusion or vulnerable transitive package.
- Sandbox escape into Electron main/preload/Node.js.
- Renderer XSS combined with plugin capabilities.
- Exfiltration of messages, files, tokens, microphone/screen content, or private channel metadata.
- UI spoofing of auth, permissions, system dialogs, updates, or trusted Picom controls.
- Persistence, hidden background work, cryptomining, denial of service, and memory/event floods.
- Confused-deputy calls through an over-broad host API.
- Permission escalation during plugin update.
- Revoked plugin continuing offline or through stale caches.
- Cross-platform differences creating weaker Windows/Linux/macOS enforcement.

Because impact can include the user's desktop account, a plugin system should not be built until the sandbox and distribution model have independent security review.

## Security boundaries

### Renderer

The existing Picom renderer remains trusted application UI. Plugin code must never run in the same JavaScript global, React tree, Vite module graph, or origin. A plugin cannot import Picom components/services or access DOM nodes outside an approved isolated surface.

### Preload and IPC

Existing preload APIs remain whitelisted and unavailable to plugins. A future plugin broker would expose a separate capability protocol with schema-validated messages, bounded payloads, request IDs, rate limits, timeouts, and revocation. It must never forward arbitrary IPC channel names or Electron objects.

### Main process

The Electron main process cannot evaluate plugin code. It may supervise a dedicated sandbox process only after the sandbox is proven. Crashes, timeouts, resource-limit violations, and policy failures must terminate that process without affecting Picom's main window/session.

### Backend

Supabase RLS and API permissions remain authoritative. A desktop plugin cannot receive service-role credentials or bypass backend rules. User-delegated API calls require narrow scopes, explicit consent, short-lived tokens, and server enforcement.

## Sandboxing options

No option is approved yet. Candidates require prototypes and adversarial testing.

### Declarative extensions only

Safest initial option: plugins are signed JSON manifests containing commands, menu labels, forms, and webhook/Bot API actions. The Picom host renders allowlisted components and executes allowlisted backend operations. No third-party code runs locally.

Advantages:

- Minimal sandbox escape surface.
- Consistent design/accessibility enforcement.
- Easier permission and schema validation.

Limitations:

- Less flexibility.
- Manifest complexity can become a programming language and must remain bounded.

### Isolated utility process

A future Electron `utilityProcess` or separately packaged restricted process could execute reviewed code with:

- No Node.js standard library exposure by default.
- OS-level sandbox/container profile.
- No inherited environment or filesystem handles.
- Network denied unless brokered by a capability API.
- CPU, memory, process-count, message-size, and execution-time quotas.
- One process or stronger isolation per plugin.
- Signed immutable package mounted/read-only where possible.

This remains risky and needs platform-specific sandbox proof for Windows, Linux, and macOS.

### WebAssembly sandbox

WebAssembly with a minimal host ABI may reduce language/runtime surface but does not automatically provide security. The host imports define all power and must be capability-limited. Resource exhaustion, parser/runtime vulnerabilities, WASI filesystem/network imports, and supply chain remain concerns.

### Sandboxed iframe/webview

Not preferred. Electron webviews and remote content increase origin, navigation, CSP, popup, download, and permission complexity. A same-process iframe does not isolate CPU/memory and must never receive `allow-same-origin` plus scripts with sensitive host messaging.

## Recommended phased approach

1. Keep runtime plugins disabled.
2. Expand documented Bot API/webhook capabilities for server-side integrations.
3. Evaluate declarative, host-rendered UI manifests only.
4. Build an offline threat-model prototype with no production data.
5. Compare utility-process and WebAssembly sandboxes through red-team tests.
6. Define signing, review, revocation, and permission UX.
7. Complete independent security review before any internal opt-in experiment.
8. Never enable public publishing until incident response and kill switches are proven.

## Signing and review

Every plugin package would require:

- Stable plugin/application ID and verified publisher identity.
- Manifest schema version and minimum/maximum Picom compatibility.
- Content hash and organization-controlled signature.
- Reproducible build/provenance metadata where practical.
- Static dependency, license, malware, and secret scan.
- Manual security/privacy/UI review for requested capabilities.
- Automated behavior tests in supported platform sandboxes.
- Immutable versioned artifacts.
- Revocation list and emergency kill switch checked before activation.

Signing proves publisher/artifact integrity, not safety. Review is required for every permission expansion and significant update. Publisher private keys remain outside the repository and desktop client.

## Bot API vs desktop plugin

| Concern | Bot API | Desktop plugin |
| --- | --- | --- |
| Execution | Developer-hosted/backend integration | Potential local sandbox process |
| Identity | Bot credential and community role | User-installed extension identity |
| Data | Server-filtered events/actions | Only brokered user-authorized capabilities |
| UI | Bot messages/commands | Narrow host-rendered extension surfaces |
| Native access | None | None by default; never raw Electron/OS APIs |
| Preferred use | Automation and channel workflows | Only capabilities impossible through Bot API |

Picom should prefer the Bot API or webhooks whenever an integration does not require local UI. Bots remain role/RLS/rate-limit/audit controlled and cannot execute inside Picom.

## Allowed UI extension points

If declarative extensions are approved, initial allowlist should be narrow:

- Command Palette command that invokes an approved capability.
- Community settings informational panel for the owning integration.
- Message action that receives only message ID after backend visibility recheck.
- Composer action that returns plain text or approved attachment reference after confirmation.
- Read-only status card in Developer Portal.

Host restrictions:

- Picom renders all controls with design tokens and `AppIcon`.
- No raw HTML/CSS/JavaScript, iframe, overlay, titlebar, login, payment, update, permission, or system-dialog replacement.
- No absolute/fixed positioning outside assigned slot.
- No unbounded lists, animation, z-index, keyboard capture, clipboard monitoring, or focus traps.
- Text length, icon choice, actions, network payloads, and rendering frequency are bounded.
- Extension UI is visibly labeled with publisher/plugin identity.

## Forbidden UI capabilities

- Rendering over login, auth, security, update, crash recovery, or permission prompts.
- Mimicking Picom/OS password, token, keychain, file, or screen-recording dialogs.
- Reading keystrokes outside focused extension controls.
- Injecting message HTML, scripts, stylesheets, link previews, or external images directly.
- Opening arbitrary protocols or external URLs outside `externalLinkService` policy.
- Creating invisible click targets or deceptive notifications.

## Permissions model

Permissions must be explicit capabilities, deny-by-default, install-time visible, and checked on every call. Example candidates:

- `commands.register`
- `community.metadata.read`
- `channel.metadata.read`
- `messages.visible.read`
- `messages.send`
- `reactions.write`
- `attachments.create`
- `ui.command_palette`
- `ui.community_settings`

No wildcard scopes. Community/channel access is intersected with the current user's backend permissions. Plugins cannot request `auth.*`, `secrets.*`, `ipc.*`, `shell.*`, `filesystem.*`, `process.*`, `screen.*`, `microphone.*`, or unrestricted network access.

Permission changes require explicit re-consent. Revocation must invalidate active sessions/capability handles immediately. Remote config may disable availability, but backend permissions remain authoritative.

## Network model

Plugins receive no direct socket or arbitrary fetch API. If needed, a host broker would:

- Allow HTTPS only.
- Require reviewed domain allowlists.
- Block loopback, private network, file/data/custom schemes, redirects to disallowed hosts, and DNS rebinding.
- Strip cookies, auth headers, referrers, filesystem paths, and Picom credentials.
- Enforce size, method, timeout, concurrency, and rate limits.
- Redact logs and never return raw provider secrets.

Prefer developer-hosted Bot API calls over desktop-brokered networking.

## Storage model

Plugins cannot access Picom localStorage, IndexedDB, browser cache, auth storage, filesystem, logs, drafts, or message cache. A future broker may offer a small namespaced key/value store with quotas, schema validation, encryption policy, and clear-data controls. Sensitive credentials should not be stored by desktop plugins.

## Audit requirements

Audit content-free events for install, update, enable/disable, permission grant/revoke, signature/review result, capability denial, sandbox crash/timeout, network-domain denial, and security kill switch. Do not log message content, tokens, filesystem paths, clipboard data, or arbitrary plugin payloads.

## Security validation

Before implementation:

- Threat-model review and abuse cases.
- Electron sandbox/IPC penetration tests.
- CSP and renderer XSS review.
- Windows/Linux/macOS process and filesystem escape tests.
- Resource exhaustion and event-flood tests.
- Signature downgrade/replay/revocation tests.
- Malicious manifest/parser tests.
- Permission confused-deputy and TOCTOU tests.
- Update rollback and incompatible-version tests.
- Supply-chain incident drill.

## Residual risks

Even a reviewed sandbox can contain vulnerabilities. Desktop plugins increase attack surface, release/support cost, privacy obligations, cross-platform divergence, and incident severity. If declarative extensions plus Bot API cover user needs, Picom should not build a local code runtime.

