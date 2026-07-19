import type { MouseEvent } from "react";
import type { Channel } from "../types/community";
import type { VoiceChannelParticipant } from "../types/voiceDiscovery";
import { resolveChannelSidebarIcon } from "../utils/channelSidebarIcon";
import { formatMentionBadge, formatMentionLabel, normalizeMentionCount } from "../utils/mentionUtils";
import { AppIcon } from "./AppIcon";

type ChannelItemProps = {
  channel: Channel;
  active: boolean;
  onSelect: (channel: Channel) => void;
  onContextMenu: (event: MouseEvent, channel: Channel) => void;
  hasDraft?: boolean;
  voiceParticipants?: readonly VoiceChannelParticipant[];
};

function getVoiceParticipantState(participant: VoiceChannelParticipant): "speaking" | "silent" | "muted" {
  if (participant.isMicrophoneEnabled === false) {
    return "muted";
  }

  if (participant.isSpeaking) {
    return "speaking";
  }

  return "silent";
}

export function ChannelItem({ channel, active, onSelect, onContextMenu, hasDraft = false, voiceParticipants = [] }: ChannelItemProps) {
  // Voice channels always show the voice-chat logo; speaking state only affects participants below.
  const icon = channel.type === "voice" ? "voice" : resolveChannelSidebarIcon(channel);
  const mentionCount = normalizeMentionCount(channel.mentions);
  const mentionLabel = formatMentionBadge(mentionCount);
  const mentionBadgeLabel = formatMentionLabel(mentionCount);
  const showTrailing = channel.unread || hasDraft || mentionCount > 0;
  const showVoiceParticipants = channel.type === "voice" && voiceParticipants.length > 0;
  const someoneSpeaking = voiceParticipants.some((participant) => participant.isSpeaking === true && participant.isMicrophoneEnabled !== false);

  return (
    <div className={`channel-voice-entry${showVoiceParticipants ? " has-participants" : ""}${someoneSpeaking ? " is-speaking" : ""}`}>
      <button
        className={`channel-item channel-type-${channel.type} ${active ? "active" : ""} ${mentionCount ? "has-mentions" : ""}${someoneSpeaking ? " is-voice-speaking" : ""}`}
        aria-current={active ? "page" : undefined}
        aria-label={channel.name}
        onClick={() => onSelect(channel)}
        onContextMenu={(event) => onContextMenu(event, channel)}
      >
        <span className="channel-item-icon" aria-hidden="true" data-channel-icon={icon}>
          <AppIcon name={icon} size="sm" />
        </span>
        <span className="channel-name">{channel.name}</span>
        {showTrailing ? (
          <span className="channel-item-trailing">
            {channel.unread ? <span className="channel-unread" aria-label="Unread channel" /> : hasDraft ? <span className="channel-draft-indicator">Draft</span> : null}
            {mentionCount ? (
              <span className="mention-badge" aria-label={mentionBadgeLabel} title={mentionBadgeLabel}>
                {mentionLabel}
              </span>
            ) : null}
          </span>
        ) : null}
      </button>
      {showVoiceParticipants ? (
        <ul className="channel-voice-users" aria-label={`${voiceParticipants.length} connected in ${channel.name}`}>
          {voiceParticipants.map((participant) => {
            const voiceState = getVoiceParticipantState(participant);
            return (
              <li key={participant.identity} className={`is-${voiceState}`}>
                {voiceState === "speaking" ? (
                  <span className="channel-voice-user-speaking" aria-hidden="true">
                    <AppIcon name="microphone" size="xs" />
                  </span>
                ) : null}
                <span className="channel-voice-user-name">{participant.name}</span>
                {voiceState === "muted" ? <AppIcon name="volumeOff" size="xs" aria-label="Muted" /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
