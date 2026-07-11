# Desktop E2E Core-Flow Contract

Picom's blocking `e2e:coverage:contract` maps every release-critical desktop flow to existing source entry points and deterministic preflight commands. It does not claim that a Playwright/Electron UI runner exists.

## Podcast Full MVP flow

The Podcast flow covers:

- typed Podcast community creation and default Publisher/Editor roles;
- private draft, media validation/upload contract, publish, unpublish, archive, and delete;
- player transport, seek, speed, queue, resume, and completed state;
- save, reaction add/remove, comments, and reply-safe listener state;
- Feed mentions, Profile sections, Search, exact deep links, and notifications;
- Publisher/Editor hierarchy, comment/episode moderation, reports, copyright reason, and append-only audit;
- public/private visibility, private Storage, RLS, and blocked/deleted content boundaries.

The manifest keeps mock and staging plans separate and forbids production targeting. Hosted Supabase, Storage, Realtime, native package, and clean-machine evidence remain external gates until a real runner and protected environment are available.

## Activation requirements

Before changing `runnerStatus` from `planned`, add a pinned and license-reviewed Electron UI runner, deterministic setup/teardown, safe local fixtures, Windows/Linux execution, macOS evidence, artifact redaction, retries limited to proven infrastructure failures, and reviewed failure triage ownership.
