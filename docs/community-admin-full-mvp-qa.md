# Community Administration Full MVP QA

## Scope matrix

| Area | Owner | Admin | Moderator | Member | Visitor | Text | Radio | Podcast |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Role creation/order/delete | Full | Permission/hierarchy limited | No | No | No | Yes | Yes | Yes |
| Multi-role assignment | Full | Lower roles only | No | No | No | Yes | Yes | Yes |
| Structure management | Full | Permission limited | No | No | Public view only | Categories/channels | Station/program surfaces | Series/episode surfaces |
| Invites/join | Full | Permission limited | Optional permission | Accept/leave | Public preview/join | Yes | Yes | Yes |
| Moderation/reports | Full | Permission limited | Scoped | Report only | Report/public view | Messages | Sessions/comments | Episodes/comments |
| Audit | Read/export | With `viewAuditLog` | No normal access | No | No | Yes | Yes | Yes |
| Ownership/archive | Full + re-auth | No | No | No | No | Atomic | Atomic | Atomic |
| Branding/rules/type settings | Full | `manageCommunity` | No | Accept rules | Read/accept rules | Message defaults | Host/schedule/listener defaults | Publisher/comment/explicit defaults |

## Security assertions

- UI section visibility is UX only; RPC/RLS remains authoritative.
- Owner, self, equal, and higher-role protections are server enforced.
- Role, moderation, ownership, archive, and settings changes append redacted audit evidence.
- Private channels and unrelated report/DM content are excluded from visitor/community queues.
- Community archive retains audit/security data and does not hard-delete rows.

## Automated gates

`npm run community:admin-full-mvp:qa` verifies the active routes and requires the existing role, assignment, structure, invite, visitor, moderation, audit, danger-zone, branding, and three-kind scripts. Feature scripts are still run independently so one aggregate assertion cannot hide a real failure.

Visual and E2E manifests now include Community Admin role/kind coverage. Pixel screenshots and interactive Electron E2E remain `BLOCKED`: the repository truthfully declares visual mode `contract_only` and E2E runner status `planned`. These contracts validate coverage architecture, not executed clicks or screenshots.

Hosted pgTAP/RLS/Storage execution also remains `BLOCKED` without an approved Supabase CLI/staging credential context.

## Local result

- Aggregate contract: PASS
- 16 independent role/assignment/structure/invite/visitor/moderation/audit/danger/settings/kind gates: PASS
- Typecheck, mock smoke, production build, and QA smoke: PASS
- Visual coverage contract: PASS, 33 deterministic desktop scenarios
- E2E coverage contract: PASS, 17 mapped flows
- Renderer performance budget: PASS under hard caps
- Pixel screenshots / Electron interaction runner: BLOCKED, not installed or enabled
- Hosted Supabase pgTAP/RLS/Storage: BLOCKED, approved CLI/staging context unavailable
