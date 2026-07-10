# Privacy Data Export and Account Deletion

Data exports are asynchronous server requests. The renderer may download only a clearly labeled local safety preview; production exports must be generated under RLS and include only data the authenticated user owns or can access.

Exports must never contain password hashes, auth/session/refresh tokens, cookies, service keys, signing credentials, raw IP addresses, inaccessible private channels, unrelated audit logs, or internal server-only fields.

Account deletion is a request workflow, not immediate hard deletion. Users must type their exact username. Community owners must transfer ownership first. The backend records `deletion_requested_at` and a request row for operator/background review. Final processing must revoke sessions, anonymize the profile where appropriate, preserve audit integrity, apply retention rules, and avoid breaking owned community data.
