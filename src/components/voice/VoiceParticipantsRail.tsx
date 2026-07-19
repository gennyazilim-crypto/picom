import { useMemo, type MouseEvent } from "react";
import type { Channel, Community, Member, Message } from "../../types/community";
import type { CommunityAccess } from "../../types/communityAccess";
import type { VoiceParticipant, VoiceServiceSnapshot } from "../../services/voiceService";
import type { VoiceRoomOccupancy } from "../../types/voiceDiscovery";
import { AppIcon } from "../AppIcon";
import { mvpUiIconMap } from "../iconRegistry";
import { VoiceParticipantList } from "../VoiceRoomView";
import { resolveVoiceParticipants } from "./voiceParticipantsModel";
import { VoiceRoomChatPanel } from "./VoiceRoomChatPanel";
import "./VoiceParticipantsRail.css";

const voiceParticipantsRailIcons = mvpUiIconMap.chatHeader;

type ToastTone = "info" | "error" | "success";

type VoiceParticipantsRailProps = {
  community: Community;
  channel: Channel;
  channelId: string;
  access: CommunityAccess;
  messages: Message[];
  currentUser: Member;
  currentUserId: string;
  snapshot: VoiceServiceSnapshot;
  voiceOccupancy?: VoiceRoomOccupancy;
  expanded: boolean;
  onToggleExpanded: () => void;
  onSendMessage: (body: string) => void | Promise<void>;
  onExpireMessage?: (message: Message) => void | Promise<void>;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  pushToast: (message: string, tone?: ToastTone) => void;
  canMuteMembers?: boolean;
  canRemoveFromVoice?: boolean;
  onModerateParticipant?: (participant: VoiceParticipant, action: "mute" | "remove") => void;
  onOpenProfile?: (event: MouseEvent, member: Member) => void;
  onParticipantContextMenu?: (event: MouseEvent, member: Member, participant: VoiceParticipant) => void;
};

export function VoiceParticipantsRail({
  community,
  channel,
  channelId,
  access,
  messages,
  currentUser,
  currentUserId,
  snapshot,
  voiceOccupancy,
  expanded,
  onToggleExpanded,
  onSendMessage,
  onExpireMessage,
  onTypingStart,
  onTypingStop,
  pushToast,
  canMuteMembers = false,
  canRemoveFromVoice = false,
  onModerateParticipant,
  onOpenProfile,
  onParticipantContextMenu,
}: VoiceParticipantsRailProps) {
  const participants = resolveVoiceParticipants(snapshot, channelId, voiceOccupancy, currentUserId);
  const participantNamesByIdentity = useMemo(() => {
    const map = new Map<string, string>();
    for (const participant of participants) {
      if (participant.identity && participant.name) map.set(participant.identity, participant.name);
    }
    return map;
  }, [participants]);

  if (!expanded) {
    return (
      <aside
        className="voice-participants-rail voice-participants-rail--collapsed"
        data-sidebar-kind="voice-participants"
        aria-label="Voice room participants"
      >
        <button
          type="button"
          className="voice-participants-rail__expand"
          aria-label={`Show voice participants (${participants.length})`}
          title={`Show voice participants (${participants.length})`}
          onClick={onToggleExpanded}
        >
          <AppIcon name={voiceParticipantsRailIcons.members} size="sm" />
          <span>{participants.length}</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="voice-participants-rail" data-sidebar-kind="voice-participants" aria-label="Voice room participants and chat">
      <header className="voice-participants-rail__head">
        <strong>Voice participants</strong>
        <div className="voice-participants-rail__head-actions">
          <span className="voice-participants-rail__count">{participants.length}</span>
          <button
            type="button"
            className="voice-participants-rail__collapse"
            aria-label="Hide voice participants"
            title="Hide voice participants"
            onClick={onToggleExpanded}
          >
            <AppIcon name="chevronRight" size="sm" />
          </button>
        </div>
      </header>
      <div className="voice-participants-rail__split">
        <section className="voice-participants-rail__participants" aria-label="Connected participants">
          <VoiceParticipantList
            community={community}
            participants={participants}
            compact
            canMuteMembers={canMuteMembers}
            canRemoveFromVoice={canRemoveFromVoice}
            onModerateParticipant={onModerateParticipant}
            onOpenProfile={onOpenProfile}
            onParticipantContextMenu={onParticipantContextMenu}
          />
        </section>
        <section className="voice-participants-rail__chat" aria-label="Voice room chat">
          <VoiceRoomChatPanel
            community={community}
            channel={channel}
            access={access}
            messages={messages}
            currentUser={currentUser}
            participantNamesByIdentity={participantNamesByIdentity}
            onSendMessage={onSendMessage}
            onExpireMessage={onExpireMessage}
            onTypingStart={onTypingStart}
            onTypingStop={onTypingStop}
            pushToast={pushToast}
          />
        </section>
      </div>
    </aside>
  );
}
