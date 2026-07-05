import { useEffect, useState } from "react";
import type { Community, Member } from "../types/community";
import { dateTimeService } from "../services/dateTimeService";
import { messageModerationFilterService } from "../services/messageModerationFilterService";
import { AppIcon } from "./AppIcon";

type MessageModerationFiltersPanelProps = {
  community: Community;
  currentUser: Member;
};

function canManageModeration(community: Community, currentUser: Member): boolean {
  const role = community.roles.find((candidate) => candidate.id === currentUser.roleId);
  return Boolean(role && (role.name === "Owner" || role.name === "Admin" || role.name === "Moderator" || role.level >= 60));
}

export function MessageModerationFiltersPanel({ community, currentUser }: MessageModerationFiltersPanelProps) {
  const [blockedWordsText, setBlockedWordsText] = useState(() => messageModerationFilterService.getSettings(community.id).blockedWords.join("\n"));
  const [maxMentions, setMaxMentions] = useState(() => messageModerationFilterService.getSettings(community.id).maxMentionsPerMessage);
  const [savedAt, setSavedAt] = useState<string | null>(() => messageModerationFilterService.getSettings(community.id).updatedAt);

  useEffect(() => {
    const settings = messageModerationFilterService.getSettings(community.id);
    setBlockedWordsText(settings.blockedWords.join("\n"));
    setMaxMentions(settings.maxMentionsPerMessage);
    setSavedAt(settings.updatedAt);
  }, [community.id]);

  if (!canManageModeration(community, currentUser)) {
    return null;
  }

  function saveFilters() {
    const next = messageModerationFilterService.saveSettings(community.id, blockedWordsText, maxMentions);
    setBlockedWordsText(next.blockedWords.join("\n"));
    setMaxMentions(next.maxMentionsPerMessage);
    setSavedAt(next.updatedAt);
  }

  return (
    <section className="moderation-filter-card" aria-label="Message moderation filters placeholder">
      <div className="moderation-filter-head">
        <span>
          <AppIcon name="lock" size="sm" />
        </span>
        <div>
          <strong>Moderation filters</strong>
          <small>Local blocked words placeholder.</small>
        </div>
      </div>
      <textarea value={blockedWordsText} onChange={(event) => setBlockedWordsText(event.target.value)} rows={3} placeholder="one blocked word per line" aria-label="Blocked words" />
      <label>
        <span>Max mentions</span>
        <input type="number" min={1} max={50} value={maxMentions} onChange={(event) => setMaxMentions(Number(event.target.value))} />
      </label>
      <button type="button" onClick={saveFilters}>Save filters</button>
      <small className="moderation-filter-status">{savedAt ? `Saved ${dateTimeService.formatMessageTime(savedAt)}` : "Not configured"}</small>
    </section>
  );
}
