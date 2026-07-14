import { useCallback, useEffect, useState } from "react";
import { ringtoneService } from "../services/voice/ringtoneService";
import { notificationService } from "../services/notificationService";
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
}>;

export type UseVoiceCallInvitesResult = Readonly<{
  incoming: IncomingVoiceCall | null;
  outgoing: OutgoingVoiceCall | null;
  accept: () => void;
  decline: () => void;
  cancelOutgoing: () => void;
  dismissOutgoing: () => void;
}>;

export function useVoiceCallInvites({ currentUser, enabled, onAccept }: UseVoiceCallInvitesInput): UseVoiceCallInvitesResult {
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

  // Ring + native alert while a call is incoming; stop the tone the moment it clears.
  useEffect(() => {
    if (!incoming) {
      ringtoneService.stop();
      return;
    }
    ringtoneService.start();
    if (typeof document === "undefined" || !document.hasFocus()) {
      const body = incoming.room.kind === "community" ? `Voice call in ${incoming.room.channelName}` : "Direct voice call";
      const deepLink = incoming.room.kind === "community" ? `picom://community/${incoming.room.communityId}/channel/${incoming.room.channelId}` : undefined;
      void notificationService.showNotification({
        title: `${incoming.caller.name} is calling`,
        body,
        category: "incoming_call",
        tag: `voice-call-${incoming.inviteId}`,
        ...(deepLink ? { deepLink } : {}),
        routing: { appFocused: false },
      });
    }
    return () => ringtoneService.stop();
  }, [incoming]);

  const accept = useCallback(() => {
    ringtoneService.stop();
    void voiceCallInviteService.accept().then((call) => {
      if (call) onAccept(call.room);
    });
  }, [onAccept]);

  const decline = useCallback(() => {
    ringtoneService.stop();
    void voiceCallInviteService.decline();
  }, []);

  const cancelOutgoing = useCallback(() => {
    void voiceCallInviteService.cancel("canceled");
  }, []);

  const dismissOutgoing = useCallback(() => {
    voiceCallInviteService.dismissOutgoing();
  }, []);

  return { incoming, outgoing, accept, decline, cancelOutgoing, dismissOutgoing };
}
