# Task 334 - Social login provider finalization

Status: code prepared; Google/Apple production enablement blocked on hosted provider certification.

- Google and Apple PKCE/profile bootstrap paths remain behind disabled-by-default flags.
- Provider login does not bypass Picom Terms/Privacy acceptance.
- Provider secrets remain dashboard/server-only.
- Steam and Epic remain unapproved MVP+ work with no UI entry points.
- Hosted provider setup, callback, linking, recovery and three-platform packaged tests remain blockers.

Validation:
- Documentation-only finalization decision; runtime code was unchanged.
- `npm run typecheck`, `npm run mock:smoke` and `npm run build` were skipped because Task 334 changes Markdown only.
