# Picom captions agent

This server-side LiveKit Agent publishes Deepgram Nova-3 speech-to-text results through LiveKit's `lk.transcription` text stream. It does not persist raw audio or transcript text.

Required server-only environment variables:

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `DEEPGRAM_API_KEY`
- `PICOM_CAPTIONS_AGENT_CALLBACK_URL`
- `PICOM_CAPTIONS_AGENT_CALLBACK_SECRET`

Install with `python -m pip install -r requirements.txt`, then run `python agent.py start`. Never place these values in a renderer `VITE_*` variable or package them with the Electron client.
