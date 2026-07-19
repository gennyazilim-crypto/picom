import { useCallback, useEffect, useState } from "react";
import { profileAvatarService } from "../services/profileAvatarService";
import { ringtoneService } from "../services/voice/ringtoneService";
import { notificationService } from "../services/notificationService";
import {
  incomingCallDesktopToastService,
  shouldSurfaceDesktopIncomingCall,
} from "../services/voice/incomingCallDesktopToastService";
import {
  voiceCallInviteService,
  type IncomingVoiceCall,
  type OutgoingVoiceCall,
  type VoiceCallParty,
  type VoiceCallRoom,
} from "../services/voice/voiceCallInviteService";

type UseVoiceCallInvitesInput = Readonly<{
  currentUser: VoiceCallParty | null;
  enabled: boolean;
  onAccept: (room: VoiceCallRoom) => void;
  onMessageCaller?: (caller: VoiceCallParty, room: VoiceCallRoom) => void;
}>;

export type UseVoiceCallInvitesResult = Readonly<{
  incoming: IncomingVoiceCall | null;
  outgoing: OutgoingVoiceCall | null;
  accept: () => void;
  decline: () => void;
  cancelOutgoing: () => void;
  dismissOutgoing: () => void;
}>;

export function useVoiceCallInvites({ currentUser, enabled, onAccept, onMessageCaller }: UseVoiceCallInvitesInput): UseVoiceCallInvitesResult {
  const [incoming, setIncoming] = useState<IncomingVoiceCall | null>(null);
  const [outgoing, setOutgoing] = useState<OutgoingVoiceCall | null>(null);

  const currentUserId = currentUser?.id ?? null;
  const currentUserName = currentUser?.name ?? null;
  const currentUserAvatar = currentUser?.avatarUrl ?? null;

  useEffect(() => {
    if (!enabled || !currentUserId || !currentUserName) return;
    voiceCallInviteService.configure({ id: currentUserId, name: currentUserName, avatarUrl: currentUserAvatar ?? undefined });
    voiceCallInviteService.start();
    const offIncoming = voiceCallInviteService.onIncoming(setIncoming);
    const offOutgoing = voiceCallInviteService.onOutgoing(setOutgoing);
    setIncoming(voiceCallInviteService.getIncoming());
    setOutgoing(voiceCallInviteService.getOutgoing());

    return () => {
      offIncoming();
      offOutgoing();
      voiceCallInviteService.stop();
    };
  }, [enabled, currentUserId, currentUserName, currentUserAvatar]);

  useEffect(() => {
    if (!incoming) return;
    let active = true;
    const inviteId = incoming.inviteId;
    void profileAvatarService.resolveIncomingCaller(incoming).then((caller) => {
      if (!active) return;
      setIncoming((current) => current?.inviteId === inviteId ? { ...current, caller } : current);
    });
    return () => {
      active = false;
    };
  }, [incoming?.inviteId]);

  // Ring while Picom is open; when unfocused/tray-hidden also raise a Mark-style
  // desktop toast + OS notification so the call is visible outside the main window.
  useEffect(() => {
    if (!incoming) {
      ringtoneService.stop();
      void incomingCallDesktopToastService.dismiss();
      return;
    }

    ringtoneService.start();

    const syncDesktopSurface = async () => {
      if (!shouldSurfaceDesktopIncomingCall()) {
        void incomingCallDesktopToastService.dismiss();
        return;
      }
      const shown = await incomingCallDesktopToastService.show(incoming);
      if (shown) return;
      const body = incoming.room.kind === "community" ? `Voice call in ${incoming.room.channelName}` : "Direct voice call";
      const deepLink = incoming.room.kind === "community"
        ? `picom://community/${incoming.room.communityId}/channel/${incoming.room.channelId}`
        : `picom://dm/${incoming.room.conversationId}`;
      await notificationService.showNotification({
        title: `${incoming.caller.name} is calling`,
        body,
        category: "incoming_call",
        tag: `voice-call-${incoming.inviteId}`,
        silent: true,
        deepLink,
        routing: { appFocused: false },
      });
    };

    void syncDesktopSurface();

    window.addEventListener("focus", syncDesktopSurface);
    window.addEventListener("blur", syncDesktopSurface);
    document.addEventListener("visibilitychange", syncDesktopSurface);

    return () => {
      ringtoneService.stop();
      void incomingCallDesktopToastService.dismiss();
      window.removeEventListener("focus", syncDesktopSurface);
      window.removeEventListener("blur", syncDesktopSurface);
      document.removeEventListener("visibilitychange", syncDesktopSurface);
    };
  }, [incoming]);

  const accept = useCallback(() => {
    ringtoneService.stop();
    void incomingCallDesktopToastService.dismiss();
    void voiceCallInviteService.accept().then((call) => {
      if (call) onAccept(call.room);
    });
  }, [onAccept]);

  const decline = useCallback(() => {
    ringtoneService.stop();
    void incomingCallDesktopToastService.dismiss();
    void voiceCallInviteService.decline();
  }, []);

  const cancelOutgoing = useCallback(() => {
    void voiceCallInviteService.cancel("canceled");
  }, []);

  const dismissOutgoing = useCallback(() => {
    voiceCallInviteService.dismissOutgoing();
  }, []);

  useEffect(() => {
    return incomingCallDesktopToastService.onAction((payload) => {
      const call = voiceCallInviteService.getIncoming();
      if (!call || call.inviteId !== payload.inviteId) {
        void incomingCallDesktopToastService.dismiss();
        return;
      }
      if (payload.action === "accept") {
        accept();
        return;
      }
      if (payload.action === "message") {
        const caller = call.caller;
        const room = call.room;
        decline();
        onMessageCaller?.(caller, room);
        return;
      }
      decline();
    });
  }, [accept, decline, onMessageCaller]);

  return { incoming, outgoing, accept, decline, cancelOutgoing, dismissOutgoing };
}
