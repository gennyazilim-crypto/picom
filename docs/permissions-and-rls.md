# Permissions and RLS evidence map

## Feed

- Feed RPCs must return only sources the caller can view.
- Private channel content, attachments and comments must never be exposed through Feed, search, cache or Realtime.
- Read/saved/follow state is caller-owned.

## Direct Messages

The DM completion migration defines participant checks, two-party conversation creation, idempotent send, read cursors, reaction/attachment policies and private Storage path policies. Non-participants must receive no metadata, message, reaction, attachment or signed URL.

## Communities

Community migrations define founder ownership, member roles, public join/rules acceptance and hardened table policies. Frontend role checks are presentation only; owner/admin/moderator/member/visitor access must be enforced in Postgres.

## Profile media

Avatar and cover writes use the central profile-media service and private canonical Storage paths. Public identity fields must expose only approved projections/signed URLs, not object enumeration.

## Evidence status

| Evidence | Status |
| --- | --- |
| Migration source present | Confirmed locally |
| Local RLS contract scripts | Must pass in validation |
| Hosted positive tests | Not executed in this pass |
| Hosted negative tests | Not executed in this pass |
| Service-role bypass audit | Requires protected environment review |
| Two-session private-content leak test | Not executed |

Source presence is not deployment evidence. Production approval requires the hosted negative matrix.
