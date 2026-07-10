# Plugin sandbox prototype result

## Result

Executed only a declarative manifest validator against synthetic committed fixtures. It accepts one bounded host-rendered status-card schema and rejects filesystem, shell, wildcard and executable entrypoint requests. A hard-coded prototype kill switch remains active.

This is not a runtime sandbox: no plugin code, process, WASM, iframe/WebView, dynamic import, `eval`, Node VM, native module, network, Electron/preload/IPC, shell or plugin-controlled filesystem operation exists. No UI/installer/sideloading/trust root is exposed to users and no production account/data is used.

## Capability model exercised

Allowlist is declarative metadata only: `ui:sidebar-card`, `commands:contribute`, `notifications:request`, `messages:send-via-bot`. Validation bounds ID/version, at most eight capabilities/contributions, allowed contribution type and title length. Unknown/forbidden fields fail closed.

The harness does not grant these capabilities or call backend actions. Future actions still require approved broker, user/admin consent, backend/RLS, bot identity, rate limit, audit and revocation.

## Security conclusion

Schema validation reduces malformed-manifest risk but proves no OS/process sandbox property. Out-of-process isolation, signatures, resource quotas, broker protocol, cross-platform escape tests and independent security review remain unimplemented. Policy approval is absent; therefore no executable prototype proceeds.

Run `npm run plugins:sandbox:prototype` to reproduce the offline validator.
