import { useMemo, useState } from "react";
import type { Member } from "../../types/community";

type VoiceInvitePickerProps = Readonly<{
  members: readonly Member[];
  currentUserId: string;
  onSelect: (member: Member) => void;
  onClose: () => void;
}>;

export function VoiceInvitePicker({ members, currentUserId, onSelect, onClose }: VoiceInvitePickerProps) {
  const [query, setQuery] = useState("");

  const invitable = useMemo(() => {
    const term = query.trim().toLowerCase();
    return members
      .filter((member) => member.userId !== currentUserId && !member.isBot)
      .filter((member) => !term || member.displayName.toLowerCase().includes(term) || member.username.toLowerCase().includes(term))
      .slice(0, 50);
  }, [members, currentUserId, query]);

  return (
    <div className="voice-call-overlay" role="dialog" aria-modal="true" aria-label="Invite someone to voice" onClick={onClose}>
      <div className="voice-call-card voice-invite-picker" onClick={(event) => event.stopPropagation()}>
        <div className="voice-call-title">Invite to voice</div>
        <input
          className="voice-invite-picker__search"
          type="text"
          value={query}
          autoFocus
          maxLength={80}
          placeholder="Search friends or members…"
          aria-label="Search friends or members"
          onChange={(event) => setQuery(event.target.value)}
        />
        <ul className="voice-invite-picker__list">
          {invitable.length === 0 ? (
            <li className="voice-invite-picker__empty">
              {query.trim()
                ? "No matches."
                : "No friends or community members available to invite."}
            </li>
          ) : (
            invitable.map((member) => (
              <li key={member.userId}>
                <button type="button" className="voice-invite-picker__row" onClick={() => onSelect(member)}>
                  <span className="voice-invite-picker__avatar" aria-hidden="true">
                    {member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : member.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="voice-invite-picker__name">
                    {member.displayName}
                    <small>@{member.username}{member.status !== "offline" ? ` · ${member.status}` : ""}</small>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        <button type="button" className="voice-call-btn voice-call-btn--decline" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
