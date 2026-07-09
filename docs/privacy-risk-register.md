# Picom Privacy Risk Register

| ID | Risk | Impact | Current control | Residual risk / required action | Owner |
| --- | --- | --- | --- | --- | --- |
| PR-01 | Private channel rows visible to visitors | Critical confidentiality breach | RLS and public-read helper policies; static pgTAP scenarios | Run real CLI/deployed RLS tests with separate accounts | Backend/security |
| PR-02 | Private attachment object can be fetched directly | Critical confidentiality breach | Private bucket policies tied to visible attached messages | Verify signed/direct URL behavior against staging Storage | Backend/security |
| PR-03 | Privileged Supabase or LiveKit secret enters renderer | Account/environment compromise | Renderer env allowlist, secret scan, no `VITE_` server secrets | Enforce CI secret scan and rotate on suspected exposure | Release/security |
| PR-04 | Diagnostics contain credentials or private content | High privacy breach | Central redaction, bounded logs, explicit opt-in export | Manual review before sharing; add regression fixtures for new fields | Desktop/security |
| PR-05 | External link invokes unsafe protocol | Code/data access risk | Central allowlist and safe desktop shell bridge | Continue auditing new link entry points | Desktop |
| PR-06 | Malicious or disguised upload | User/device safety risk | MIME/extension/size checks, Edge validation, private storage | Content-byte validation and malware scanner are not active yet | Backend/security |
| PR-07 | Long-lived or over-privileged LiveKit token | Voice-room privacy risk | Server-side token Edge Function | Verify TTL, identity, room grants, and error logs in deployed function | Realtime/security |
| PR-08 | Public registration without informed consent | Legal/privacy risk | Required Terms and Privacy acceptance | Placeholder legal text needs counsel approval and versioned consent record | Product/legal |
| PR-09 | Realtime subscription bypasses expected visibility | Private message leak | Supabase Realtime follows table RLS | Run two-window visitor/private-channel tests against staging | Backend/security |
| PR-10 | Local cache/logs remain on shared desktop | Local privacy exposure | Redacted logs and explicit cache controls | Define retention and secure storage behavior before stable release | Desktop/product |

## Review cadence

- Review blocker/critical entries before every beta/stable release decision.
- Update an entry when a control, owner, evidence link, or residual risk changes.
- Security reports are handled outside the normal public feedback backlog and must not include raw credentials or unnecessary private content.
