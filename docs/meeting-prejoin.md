# Meeting PreJoin

Task 544 adds a desktop PreJoin surface inside the lazy meeting workspace. It shows community, room, host, join policy, and waiting-room expectations before any provider connection.

Camera capture starts only after the user chooses **Preview camera**. Microphone permission, microphone test, and speaker test also require explicit buttons. PreJoin never requests desktop capture, starts recording, or persists a media stream. Leaving the surface stops every preview/test track.

Safe preferences include device identifiers, join-muted, camera-off, and Noise Shield mode. Tokens, media, labels from private devices, and credentials are not persisted. Noise Shield uses supported browser echo cancellation, noise suppression, and automatic gain control; unsupported runtimes fail recoverably and do not claim enhancement.

Submit stops test/preview capture and calls the canonical `meetingService` with the selected initial media state. That service uses the real meeting-token/waiting-room path in Supabase mode and deterministic fixtures in explicit mock mode.
