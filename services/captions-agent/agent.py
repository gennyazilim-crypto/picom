"""Picom's server-side, ephemeral LiveKit captions worker."""
from __future__ import annotations

import json
import os
import urllib.request

from livekit import agents
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import deepgram, silero

AGENT_NAME = "picom-captions"
SUPPORTED_LANGUAGES = {"en", "tr", "de", "es", "fr"}


def callback(caption_session_id: str, status: str, error_code: str | None = None) -> None:
    url = os.environ.get("PICOM_CAPTIONS_AGENT_CALLBACK_URL", "").strip()
    secret = os.environ.get("PICOM_CAPTIONS_AGENT_CALLBACK_SECRET", "").strip()
    if not url or not secret:
        raise RuntimeError("Caption lifecycle callback is not configured")
    payload = {"captionSessionId": caption_session_id, "status": status}
    if error_code:
        payload["errorCode"] = error_code
    request = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), method="POST", headers={"Content-Type": "application/json", "X-Picom-Captions-Callback-Secret": secret})
    with urllib.request.urlopen(request, timeout=8) as response:
        if response.status >= 300:
            raise RuntimeError("Caption lifecycle callback was rejected")


async def entrypoint(ctx: JobContext) -> None:
    metadata = json.loads(ctx.job.metadata or "{}")
    caption_session_id = str(metadata.get("captionSessionId", ""))
    language = str(metadata.get("language", "en"))
    if not caption_session_id or metadata.get("retentionMode") != "ephemeral" or language not in SUPPORTED_LANGUAGES:
        raise RuntimeError("Invalid Picom caption dispatch metadata")
    if not os.environ.get("DEEPGRAM_API_KEY", "").strip():
        callback(caption_session_id, "failed", "CAPTION_PROVIDER_NOT_CONFIGURED")
        return

    session = AgentSession(
        stt=deepgram.STT(model="nova-3", language=language, interim_results=True, punctuate=True, smart_format=True),
        vad=silero.VAD.load(),
    )
    try:
        await ctx.connect(auto_subscribe=agents.AutoSubscribe.AUDIO_ONLY)
        await session.start(room=ctx.room, agent=Agent(instructions="Transcribe meeting speech only. Never generate replies."))
        callback(caption_session_id, "active")
        await ctx.wait_for_shutdown()
    except Exception:
        callback(caption_session_id, "failed", "CAPTION_AGENT_FAILED")
        raise
    finally:
        try:
            callback(caption_session_id, "stopped")
        except Exception:
            pass


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name=AGENT_NAME))
