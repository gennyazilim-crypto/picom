# Self-Hosted LiveKit Redis and Compose

Status: **BLOCKED_PENDING_REAL_STAGING_HOST**

The staging deployment contract is production-oriented and does not require LiveKit Cloud. It has not been executed on a dedicated Linux staging host because no host/SSH target was supplied. Voice Rooms and Screen Share remain active V1 features; public release certification remains blocked until real-host evidence passes.

## Topology

- LiveKit Server `1.13.1`, immutable manifest digest.
- Redis `7.4.9-alpine`, immutable manifest digest.
- One dedicated staging Linux VM, host networking for both containers.
- Redis binds only `127.0.0.1:6379`; it has no Compose port publication.
- LiveKit signal/API `7880` and metrics `6789` remain blocked from the public network by the Task 660 default-deny host firewall.
- Task 662 will expose only the final TLS/TURN/RTC ports and keep `7880`, `6379`, and `6789` private.
- RTC uses TCP `7881` and UDP `50000-60000`; UDP mux is not mixed into this configuration.
- Embedded TURN is explicitly disabled until Task 662 supplies verified DNS, certificates, and firewall rules.

Host networking avoids Docker's NAT/ICE ambiguity and Docker/UFW port-publishing bypass. It also means host firewall correctness is mandatory. Deploy refuses to run unless UFW is active with incoming default deny.

## Secret boundary

`generate-staging-secrets.sh` creates a unique LiveKit API key, LiveKit API secret, and Redis password with OpenSSL. Values are written only to:

- `/etc/picom-livekit/secrets/livekit.yaml`
- `/etc/picom-livekit/secrets/redis.conf`

Both files are `root:picom-livekit 0640`; the directory is `0750`. Compose receives only file paths and a non-secret supplemental group ID. Secrets are absent from Compose YAML, environment variables, command arguments, logs, evidence, and renderer bundles. Existing secret files are never overwritten without `ROTATE_STAGING_SECRETS` confirmation.

Generate on the staging host:

```bash
export PICOM_SECRET_GENERATE_CONFIRM=STAGING_ONLY
sudo --preserve-env=PICOM_SECRET_GENERATE_CONFIRM \
  infra/livekit/compose/generate-staging-secrets.sh
```

Task 663 owns production secret custody/rotation. Do not copy staging files into production.

## Deploy

After Task 660 host hardening and before public port exposure:

```bash
export PICOM_DEPLOY_CONFIRM=STAGING_ONLY
export PICOM_RELEASE_ID=selfhost-rc-001
sudo --preserve-env=PICOM_DEPLOY_CONFIRM,PICOM_RELEASE_ID \
  infra/livekit/compose/deploy-staging.sh
```

Deploy creates an immutable release directory, validates Compose, pulls only pinned digests, starts Redis before LiveKit, waits for health, verifies loopback API/metrics/Redis and recent error-level logs, then updates `/opt/picom-livekit/current`. Health failure prevents promotion.

## Status and observability

```bash
sudo infra/livekit/compose/status-staging.sh
```

The status command checks:

- both Docker health states;
- authenticated Redis `PING` without printing the password;
- loopback LiveKit health;
- loopback Prometheus metric format;
- recent LiveKit error/fatal/panic count without printing raw logs.

No microphone audio, screen frames, tokens, API keys, Redis passwords, addresses, or hostnames enter evidence.

## Stop and rollback

```bash
export PICOM_STOP_CONFIRM=STAGING_ONLY
sudo --preserve-env=PICOM_STOP_CONFIRM infra/livekit/compose/stop-staging.sh

export PICOM_ROLLBACK_CONFIRM=ROLLBACK_STAGING
sudo --preserve-env=PICOM_ROLLBACK_CONFIRM \
  infra/livekit/compose/rollback-staging.sh /opt/picom-livekit/releases/<known-good-id>
```

Stop sends SIGTERM with bounded grace periods and does not remove the Redis volume. Rollback validates and health-checks the known-good release before updating `current`; secret files and Redis data are preserved. Secret rollback/rotation requires the Task 663 procedure.

## Resource and security controls

- LiveKit limit: 3 vCPU, 6 GiB; Redis limit: 1 vCPU, 1 GiB on the 4 vCPU/8 GiB staging candidate. These are certification limits, not final production capacity.
- Read-only root filesystems, dropped capabilities, no-new-privileges, bounded local logs, init, restart policy, and graceful stop.
- Redis AOF every second and `noeviction`; raw media is never stored.
- Production capacity remains provisional until Tasks 671-672 provide measured load/TURN data.

## Blocked evidence

- Real staging container health and Redis connectivity: BLOCKED, no Linux host.
- External firewall/API/metrics denial: BLOCKED until Task 662.
- TURN and TLS: BLOCKED until Task 662.
- Real rollback timing: BLOCKED until staging deployment.
- Production deployment: out of scope for this staging task and requires separate secrets/host.
