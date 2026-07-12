# Meeting reactions and raised-hand UI

Picom uses the existing authenticated LiveKit data channel for six approved, ephemeral reactions. The renderer applies sender validation, deduplication, inbound burst protection, a five-second expiry, and a short visible cooldown. Reaction overlays are attached to the sender's participant tile and become static when reduced motion is requested.

Raised hands remain authoritative in `meeting_participant_runtime_state` and synchronize through the existing Supabase Realtime queue. The People panel presents a separate sequence-ordered raised-hand queue while leaving host-controlled participant groups unchanged. Hosts and cohosts can acknowledge a hand; reconnect refreshes the server snapshot.

In stage rooms, the control dock converts the audience hand action into request-to-speak or cancel-request. Hosts still approve or deny stage promotion through the existing stage service. Participant exit/removal clears the hand and pending stage request through the existing database trigger, and meeting teardown resets the client store.

No microphone, camera, or screen media is recorded or persisted by this feature.
