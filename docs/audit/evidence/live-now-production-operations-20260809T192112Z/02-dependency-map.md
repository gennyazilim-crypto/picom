# Dependency map

USER -> Desktop -> Supabase Auth -> DB/RPC -> Realtime
                 -> LiveKit token edge -> LiveKit SFU (voice.picom.gg)
                 -> Ingress (RTMP) -> webhook edge
                 -> workers (email / reminders / media) -> SMTP / queues
                 -> external payment/media providers (NOT_CONFIGURED / BLOCKED)

Kill switches / remote feature flags can fail-close new Go Live / discovery / chat / studio / monetization without redeploy.
