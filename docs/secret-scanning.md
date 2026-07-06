# Secret Scanning CI Placeholder

Picom must detect accidental secrets before they reach main branches or release artifacts. This plan keeps the initial CI fast and free while leaving a clear path to an open-source scanner such as Gitleaks or TruffleHog.

Do not add real secrets for scanner testing. Use synthetic placeholders only if future tests need fixtures.

## What CI should scan

- Frontend renderer code under `src/`.
- Electron main/preload code.
- Supabase Edge Functions and SQL/migration files.
- Scripts under `scripts/`.
- Documentation under `docs/`.
- Config files including `package.json`, `vite.config.ts`, Electron config, and CI workflow files.
- Environment examples such as `.env.example` and `.env.beta.example`.

## Current placeholder

The existing QA workflow runs:

```bash
npm run secrets:smoke
```

This is a fast repository smoke check for obvious secret exposure patterns. It is not a replacement for a full scanner, but it keeps CI lightweight while the project is still stabilizing.

## Future open-source scanner path

Preferred future scanner placeholder:

```bash
gitleaks detect --source . --redact --no-banner
```

Alternative:

```bash
trufflehog filesystem . --no-update --only-verified
```

Do not require a paid external service for MVP. If a GitHub Action is introduced, pin versions and keep logs redacted.

## Allowlist placeholder

If false positives appear, add a reviewed allowlist file such as `.gitleaks.toml` later. Allowlist rules must:

- Include a reason.
- Avoid broad regexes.
- Never allow real production secrets.
- Be reviewed in pull request.

No allowlist is added in this task because no scanner-specific false positives are being handled yet.

## CI policy

- Run secret scanning on pull requests and pushes to `main`.
- Keep the fast placeholder before typecheck/build so leaks fail early.
- Never print secret values in logs.
- Redact scanner output where supported.
- Scan Windows and Linux CI paths where possible because Picom is desktop-first.

## Manual local checks

```bash
npm run secrets:smoke
npm run secrets:management:smoke
```

Before release, also review:

- `.env.example` contains placeholders only.
- No `.env.local` or production env files are staged.
- Diagnostics/log exports are redacted.
- Release artifacts do not contain private env files or signing keys.

## Remaining risks

- Placeholder smoke checks can miss real-world secret formats.
- CI logs can expose secrets if commands print environment variables.
- Screenshots and diagnostic exports may leak secrets outside Git.
- A real scanner must be tuned carefully to avoid noisy false positives.

## Related documents

- `docs/secrets-management.md`
- `docs/production-deployment-checklist.md`
- `docs/incident-response.md`
