# Creator Studio Operations

## Flag rollout
1. Apply migrations 20260808390000–20260808420000
2. Certify RBAC/invite/privilege smokes
3. Keep `enableCreatorStudio` OFF in production until internal controlled enablement
4. Do not flip Task27–32 child flags when enabling Studio shell

## Sensitive actions
Use `publisher_studio_require_recent_auth` + existing step-up where available before credential rotate / finance role grants.

## Historical blockers
Studio readiness checklist surfaces Task26–32 blockers without upgrading them.
