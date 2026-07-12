# Picom V1 Voice and Screen Share Inclusion Audit

Decision: **INCLUDED**

Task 668 supersedes the pre-evidence Task 621/642 decision. Historical checkpoints remain intact.

## Evidence review

- Provider projects and protected staging secrets: provisioned without exposing values.
- Member-authorized token deployment: protected run 29194842117 passed.
- Hosted four-client Voice/Screen and denial matrix: run 29197503222 passed.
- Packaged Windows native capture and remote render: run 29198913461 passed.
- Security, rate-limit, reconnect, cleanup, and secret scan: run 29199409039 passed.
- Renderer, preload, and Edge boundaries remain typed and fail closed.

## Policy agreement

Runtime UI, active-member RLS/RPC authorization, Edge token grants, release manifest, public flags, help, diagnostics, and release copy all use the same rule: ordinary media is available to every authenticated active community member and denied to visitors/non-members/restricted memberships.

## Remaining release risks

Inclusion does not close trusted signing, clean physical-device coverage, legal approval, production provider ownership/capacity, immutable RC, or final public Go/No-Go.
