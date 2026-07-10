# Developer Portal restricted beta

The existing desktop portal is approved only as a feature-flagged, community-permission-restricted beta metadata viewer. `enableDeveloperPortal` defaults off; access additionally requires `manageCommunity` for bots or `manageChannels` for webhooks. Frontend gates do not replace backend/RLS.

My Bots shows identity/role plus non-secret credential prefix/status. Webhooks shows safe name/status selected through manager-scoped service. Raw token/hash, one-time URL, payload, private content, provider/service-role credentials and authorization headers are excluded.

Applications remains disabled: no create/update/delete, OAuth/client, API key, public publishing, marketplace or executable runtime. Documentation exposes no production API host or credential issuance instructions.

Credential creation/revocation stays in community settings. Production RPCs authorize ownership/app-admin, return raw bot token once, retain only SHA-256 hash/prefix, append content-free audit events and never make the portal a token display surface. Live deployment/RLS/security evidence remains required before enabling a production cohort.

Beta activation requires named cohort/owner, connected staging, role/RLS tests, token one-time/audit/redaction tests, abuse/rate limits, support/incident/kill switch and explicit Security/Product approval. Public publishing remains No-Go.
