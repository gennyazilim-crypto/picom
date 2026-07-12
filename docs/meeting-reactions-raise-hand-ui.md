# Meeting reactions and raised-hand UI

Picom uses the server-authoritative `send_meeting_reaction` RPC and an RLS-filtered Supabase Realtime channel for six approved, ephemeral reactions. The sender comes from `auth.uid()`, the database enforces active participation and a dedicated burst budget, and the renderer retains deduplication, inbound protection, a five-second expiry, and a short visible cooldown. Meeting LiveKit tokens do not grant data publication. Reaction overlays are attached to the sender's participant tile and become static when reduced motion is requested.

Raised hands remain authoritative in `meeting_participant_runtime_state` and synchronize through the existing Supabase Realtime queue. The People panel presents a separate sequence-ordered raised-hand queue while leaving host-controlled participant groups unchanged. Hosts and cohosts can acknowledge a hand; reconnect refreshes the server snapshot.

In stage rooms, the control dock converts the audience hand action into request-to-speak or cancel-request. Hosts still approve or deny stage promotion through the existing stage service. Participant exit/removal clears the hand and pending stage request through the existing database trigger, and meeting teardown resets the client store.

This reaction/hand feature does not add media recording or persistence; the Full MVP has no meeting recording feature.
