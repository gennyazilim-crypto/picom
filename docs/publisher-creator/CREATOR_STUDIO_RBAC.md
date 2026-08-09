# Creator Studio RBAC

Publisher-scoped RBAC distinct from community roles and platform Root RBAC.

## Built-in roles
OWNER, MANAGER, STREAM_MANAGER, MODERATOR, ANALYST, FINANCE_MANAGER, EDITOR

## Finance isolation
MANAGER / STREAM_MANAGER / MODERATOR / ANALYST do **not** receive finance.* / payout.* / kyc.* by default.
FINANCE_MANAGER receives finance/KYC/payout read-manage subset but not team.manage or chat.moderate.

## Authority
`publisher_studio_has_permission(publisher_user_id, permission_key)` is SECURITY DEFINER with fixed search_path.
Owner shortcut only when `auth.uid() = publisher_user_id` and active publisher badge.

Platform `finance.read|write|approve` (Root dashboard) remains separate and is not granted via Studio team roles.
