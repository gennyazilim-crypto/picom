import type { IncomingVoiceCall } from "./voiceCallInviteService";
import { profileAvatarService } from "../profileAvatarService";

function isDesktopBridgeAvailable(): boolean {
  return Boolean(window.picomDesktop?.incomingCall?.show);
}

function subtitleForCall(call: IncomingVoiceCall): string {
  if (call.room.kind === "community") {
    return `${call.room.communityName} · ${call.room.channelName}`.slice(0, 120);
  }
  return "Incoming call";
}

export function shouldSurfaceDesktopIncomingCall(): boolean {
  if (typeof document === "undefined") return false;
  return !document.hasFocus() || document.visibilityState === "hidden";
}

export const incomingCallDesktopToastService = {
  isAvailable(): boolean {
    return isDesktopBridgeAvailable();
  },

  async show(call: IncomingVoiceCall): Promise<boolean> {
    const bridge = window.picomDesktop?.incomingCall;
    if (!bridge) return false;
    const caller = await profileAvatarService.resolveIncomingCaller(call);
    const result = await bridge.show({
      inviteId: call.inviteId,
      callId: call.room.kind === "direct" ? call.room.callId : call.inviteId,
      conversationId: call.room.kind === "direct" ? call.room.conversationId : call.room.channelId,
      callerId: caller.id,
      callerDisplayName: caller.name,
      callerUsername: caller.username,
      callerAvatarPath: caller.avatarPath,
      callerAvatarUrl: caller.avatarUrl,
      callerAvatarUpdatedAt: caller.avatarUpdatedAt,
      callType: call.room.kind === "direct" ? call.room.callType : "voice",
      startedAt: call.room.kind === "direct" ? call.room.startedAt : call.createdAt,
      subtitle: subtitleForCall(call),
    });
    return result.ok;
  },

  async dismiss(): Promise<void> {
    const bridge = window.picomDesktop?.incomingCall;
    if (!bridge) return;
    await bridge.dismiss().catch(() => undefined);
  },

  onAction(callback: (payload: PicomIncomingCallActionPayload) => void): () => void {
    const bridge = window.picomDesktop?.incomingCall;
    if (!bridge?.onAction) return () => undefined;
    return bridge.onAction(callback);
  },
};
