# Meeting reactions and hand signaling

## Ephemeral reactions

Picom sends reaction envelopes over the LiveKit data channel topic `picom.meeting.signal.v1` with lossy delivery. The supported set is `thumbs_up`, `heart`, `celebrate`, `laugh`, `surprised`, and `clap`. Envelopes contain schema version, event ID, room/session IDs, reaction kind, send time, and expiry only. They never contain a claimed sender.

The receiver takes sender identity exclusively from LiveKit's authenticated participant callback. Unknown fields, unsupported reactions, wrong room/session IDs, malformed UUIDs, oversized packets, stale/future timestamps, duplicate IDs, and burst traffic are dropped. The sender permits five reactions per two seconds; receivers tolerate eight per sender per two seconds before dropping bursts. Reactions expire after five seconds and are not persisted.

## Authoritative hand and stage state

`meeting_participant_runtime_state` is the authority for hand order, host acknowledgement, stage request status, and server version. `update_meeting_hand_signal` supports raise/lower, host acknowledge, stage request/cancel, and host approve/deny. The RPC verifies the authenticated participant or authorized manager, active session state, stage capability, and a backend rate limit.

The queue is available through `get_meeting_hand_queue` and Realtime. New clients and reconnecting clients load the full snapshot before applying updates. Participant exit clears the hand and cancels a pending stage request. The deprecated direct hand RPC is no longer executable by authenticated clients.

Only acknowledgement and stage lifecycle changes append minimal content-free meeting events. Emoji reactions are never written to Postgres, preventing high-volume database spam.

## Abuse and evidence

Backend hand actions use the existing `user_action_rate_limits` counters. Receiver-side reaction burst drops are logged without payload, identity contents, media, IP addresses, or credentials. Hosted acceptance requires two authenticated LiveKit clients plus staged Supabase RLS tests; local structural tests cannot certify provider delivery latency.
