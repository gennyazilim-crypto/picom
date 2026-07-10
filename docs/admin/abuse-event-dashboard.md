# Abuse event dashboard

The Admin Operations abuse section is a restricted app-admin/development dashboard for privacy-safe, content-free safety
signals. It is not visible or queried when access is denied. Community Owner/Admin/Moderator roles do not
grant app-admin access.

The dashboard loads `abuse_events` only through `adminOperationsService.listSection()`. Production calls the
app-admin-only `list_admin_operations_v2` RPC; direct `abuse_events` table access is revoked from anon and
authenticated roles. Pages are cursor-based and capped at 25, with explicit Load more behavior.

Local filters cover all signals, rate-limit/webhook-rate events, upload reject/suspicious attachment events,
unauthorized private/deep-link attempts, and severity. Counts describe the currently loaded safe pages, not
global production totals. Trust & Safety aggregate counts remain the separate summary source.

Rows contain only normalized event type, allowlisted reason code, severity, and timestamp. They exclude
message/report text, attachment bytes/path/URL, user/member identity, community/channel/message IDs, raw IP,
device fingerprint, credential/token/header/cookie/session/JWT/API key, provider payload, and private context.
A signal is operational evidence, not proof of abuse; enforcement/review requires a separately authorized and
audited workflow.

The dashboard is read-only: no ban, kick, deletion, file download, report disclosure, export, or mutation is
available. Backend pagination and app-admin authorization remain mandatory even if UI filters are bypassed.
