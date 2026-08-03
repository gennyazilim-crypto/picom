# PICOM Canonical Production Worktree

## Canonical branch

`release/picom-canonical-production`

## Canonical worktree (production operations only)

`C:\Users\ACER\Desktop\picom-canonical-production`

All production migration dry-runs, db push wrappers, production builds, worker deploys, and production preflights MUST run from this worktree on the canonical branch (or from `main` only after the canonical baseline has been merged).

Guard:

```bash
npm run release:canonical:guard
```

Expected:

```text
PICOM_CANONICAL_RELEASE_GUARD=PASS
```

## DO NOT DEPLOY FROM

- `C:\Users\ACER\Desktop\picom` on `feat/community-rebuild` (development / dirty worktree)
- `C:\Users\ACER\Desktop\picom-stats-prerequisites` (`release/homepage-platform-stats-prerequisites`) — archived-reference
- `C:\Users\ACER\Desktop\picom-platform-stats` — website-only / archived-reference
- `C:\Users\ACER\Desktop\picom-stats-integration` — archived-reference
- Any temp task worktree under `%TEMP%\picom-*`
- Detached HEAD that is not a verified `picom-canonical-production-*` or `picom-publisher-phase1-production-candidate-*` tag
- Dirty worktrees

## Worktree role labels

| Path | Role |
|------|------|
| `C:\Users\ACER\Desktop\picom-canonical-production` | **production** (only allowed deploy/migrate surface) |
| `C:\Users\ACER\Desktop\picom` | development-only (may be dirty) |
| `C:\Users\ACER\Desktop\picom-stats-prerequisites` | archived-reference / do-not-deploy |
| `C:\Users\ACER\Desktop\picom-platform-stats` | website-only / do-not-deploy |
| `C:\Users\ACER\Desktop\picom-stats-integration` | archived-reference / do-not-deploy |
| Other `%TEMP%` / audit worktrees | archived-reference / do-not-deploy |

Do not delete other worktrees as part of consolidation; mark them do-not-deploy.

## Production resume gate

Production migration resume is **not** part of branch consolidation. Resume only when:

1. Canonical branch guard PASS
2. Clean canonical worktree
3. Canonical production baseline tag present
4. Explicit follow-up production task authorized
