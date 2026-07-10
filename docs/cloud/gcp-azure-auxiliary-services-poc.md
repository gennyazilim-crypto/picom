# GCP/Azure auxiliary services proof-of-concept plan

## Status

**Plan only; no cloud resources or credentials.** This POC is not approved for execution. Supabase Cloud remains Picom's Auth/Postgres/RLS/Storage/Realtime data plane and LiveKit remains separate. The POC must not replace, proxy, replicate, or migrate core chat data.

## Candidate auxiliary workload

Choose one low-risk, finite, idempotent workload using synthetic files/metadata only:

- image thumbnail generation;
- malware-scan adapter contract test with inert fixtures;
- export/checksum generation;
- retention/integrity **dry-run** counts;
- redacted operational aggregation.

Do not use message processing, authentication, public webhook ingestion, realtime fanout, voice/media, destructive cleanup, account deletion, legal hold, billing, or secrets rotation as the first POC.

## Platform mapping

### Google Cloud

- Cloud Run service for bounded authenticated HTTP work.
- Cloud Run job for finite manual/scheduled/event-triggered processing.
- Artifact Registry for pinned container images.
- Cloud Storage for synthetic/private POC objects.
- Cloud Logging/Monitoring for redacted status, latency, errors and alerts.
- Optional HTTPS load balancer/Cloud CDN only for later public non-sensitive assets; private attachments are excluded.
- Secret Manager/KMS and dedicated least-privilege service identity if a credentialed staging POC is later approved.

Cloud Run currently supports services, jobs, and worker pools; select jobs for run-to-completion tasks. Official reference: [What is Cloud Run](https://cloud.google.com/run/docs/overview/what-is-cloud-run).

### Azure

- Azure Container Apps for bounded authenticated HTTP/event services.
- Container Apps Jobs for finite manual/scheduled/event-driven tasks.
- Azure Container Registry for pinned images.
- Blob Storage for synthetic/private POC objects.
- Azure Monitor/Log Analytics for redacted telemetry.
- Optional Front Door Standard/Premium/CDN only for later public non-sensitive assets; private attachments are excluded.
- Key Vault and managed identity if a credentialed staging POC is later approved.

Container Apps supports services and finite jobs with revision/scaling features. Official references: [Container Apps overview](https://learn.microsoft.com/azure/container-apps/overview) and [Container Apps jobs](https://learn.microsoft.com/azure/container-apps/jobs).

## POC contract

Input:

- synthetic job ID and idempotency key;
- allowlisted operation/version;
- synthetic object reference or generated fixture;
- bounded size/MIME/checksum;
- expiry and request ID;
- no user/community/message identity.

Output:

- success/failure status and safe reason code;
- input/output checksums;
- duration/size counters;
- synthetic private object reference;
- no public URL, raw path, content, stack, provider metadata or secret.

The container is stateless, non-root, read-only filesystem where practical, resource/time limited, egress restricted, and fails closed. Repeated idempotency key returns the same safe result.

## Authentication and network

- First local proof runs without cloud credentials.
- Approved cloud POC uses platform identity and private/internal ingress where possible.
- Electron never calls the auxiliary service directly and receives no cloud credential.
- A trusted backend submits jobs after authorization; provider identity does not replace Supabase Auth/RLS.
- Restrict egress to required service APIs; deny arbitrary internet access.
- No production Supabase project/service-role key in POC.
- Separate project/subscription, account, network, registry, storage, logs and budget from production.

## Storage and CDN

- Use synthetic/generated fixtures only.
- Buckets/containers are private, region-pinned and lifecycle-expiring.
- Uniform/RBAC access, encryption, public-access prevention and access logs are required.
- Object names are random synthetic IDs, not local paths/user/community/message names.
- CDN is out of the initial POC. A later CDN proof must use public test assets and verify cache purge/header/log/privacy behavior.
- Real private attachment delivery continues through Supabase access rules and signed URL architecture.

## Logging and privacy

Allow: operation/version, synthetic job/request ID, status/reason code, region, image digest, coarse duration/size, retry count. Exclude body/bytes, object path, signed URL, user/profile/community/channel/message IDs, IP, Authorization header, cookies, tokens, environment dump and stack traces containing configuration.

Configure bounded retention, access control, export/sink policy, region, alerting and deletion. Cloud logging is not a secret store or product analytics pipeline.

## Provider-neutral container

- OCI image with pinned digest and SBOM/license/vulnerability scan.
- Same command, input/output contract and synthetic test suite on both providers.
- Provider adapters limited to identity, queue/job invocation, object and logging clients.
- No app-specific provider calls in React/Electron.
- Reproducible image and provenance; no `latest` tag in deployment.

## Test matrix

- happy path, malformed/oversized MIME/object, checksum mismatch;
- duplicate/replayed/out-of-order job and retry after timeout;
- CPU/memory/time limit and scale-to-zero/cold-start measurement;
- identity/ingress/egress denial and wrong project/subscription;
- private object/public access denial and lifecycle expiry;
- log redaction/retention and no secret/environment leak;
- image vulnerability/license/provenance check;
- provider outage, job cancellation, partial output cleanup;
- cost budget alert and teardown proof.

## Evaluation metrics

- p50/p95 start and execution latency;
- success/retry/timeout rate;
- maximum concurrency and downstream protection;
- compute, requests, storage, logging, registry, egress and support cost;
- deployment/rollback/teardown time;
- identity/network/security complexity;
- region availability and legal/provider fit;
- operator experience and incident visibility.

Do not select a provider from benchmark speed alone.

## Execution phases if approved

1. Approve workload, region, synthetic fixtures, threat model, budget and teardown owner.
2. Build provider-neutral local container and tests.
3. Deploy to isolated GCP project; record evidence and destroy resources.
4. Deploy same image/contract to isolated Azure subscription; record evidence and destroy resources.
5. Compare security, operations, cost and provider constraints.
6. Decide no-go, one provider, or further staging. Production integration requires a separate review.

## Guardrails and stop criteria

Stop if real data/credentials appear, public access is possible, logs contain private values, costs exceed budget, cleanup fails, provider adapter changes core behavior, or POC requires replacing Supabase. Resource teardown and credential revocation are mandatory completion criteria.

## References

- [Cloud Run overview](https://cloud.google.com/run/docs/overview/what-is-cloud-run)
- [Cloud Run jobs](https://cloud.google.com/run/docs/create-jobs)
- [Azure Container Apps overview](https://learn.microsoft.com/azure/container-apps/overview)
- [Azure Container Apps jobs](https://learn.microsoft.com/azure/container-apps/jobs)
- [Azure Front Door monitoring](https://learn.microsoft.com/azure/frontdoor/monitor-front-door)

Service capabilities, pricing, quotas, regions and preview status must be rechecked at POC approval time.
