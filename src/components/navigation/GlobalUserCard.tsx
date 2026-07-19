import { useCallback, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import type { Member } from "../../types/community";
import { globalPresenceService } from "../../services/presence/globalPresenceService";
import { globalPresenceStore } from "../../stores/globalPresenceStore";
import { AppIcon } from "../AppIcon";
import { MemberAvatar } from "../MemberAvatar";
import { VerifiedBadge } from "../VerifiedBadge";
import { PresenceMenu } from "./PresenceMenu";

export function GlobalUserCard({ currentUser, compact, onOpenProfile, onOpenUserMenu }: Readonly<{
  currentUser: Member;
  compact: boolean;
  onOpenProfile: () => void;
  onOpenUserMenu: (event: MouseEvent<HTMLButtonElement>) => void;
}>) {
  const rootRef = useRef<HTMLElement>(null);
  const presenceTriggerRef = useRef<HTMLButtonElement>(null);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const presence = useSyncExternalStore(globalPresenceStore.subscribe, globalPresenceStore.getSnapshot, globalPresenceStore.getSnapshot);
  const closePresence = useCallback((restoreFocus = false) => {
    setPresenceOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => presenceTriggerRef.current?.focus());
  }, []);

  return (
    <footer ref={rootRef} className={`global-user-card${compact ? " is-compact" : ""}`}>
      <button type="button" className="global-user-card__identity" aria-label={`Open profile for ${currentUser.displayName}`} title={compact ? currentUser.displayName : undefined} onClick={onOpenProfile}>
        <span className="global-user-card__avatar">
          <MemberAvatar member={currentUser} size={compact ? 40 : 36} />
          <i className={`global-presence-dot is-${presence.dotStatus}`} aria-label={`Presence: ${presence.label}`} />
        </span>
        {!compact ? (
          <span className="global-user-card__copy">
            <span className="global-user-card__name-row">
              <strong title={currentUser.displayName}>{currentUser.displayName}</strong>
              <VerifiedBadge verification={currentUser.verification} size="xs" />
            </span>
            {currentUser.statusText ? (
              <span className="global-user-card__status" title={currentUser.statusText}>{currentUser.statusText}</span>
            ) : null}
          </span>
        ) : null}
      </button>

      <div className="global-user-card__actions">
        <button
          ref={presenceTriggerRef}
          type="button"
          className="global-user-card__presence"
          aria-label={`Change presence. Current presence: ${presence.label}`}
          aria-haspopup="menu"
          aria-expanded={presenceOpen}
          title={presence.label}
          onClick={() => setPresenceOpen((value) => !value)}
        >
          <i className={`global-presence-dot is-${presence.dotStatus}`} aria-hidden="true" />
          <AppIcon name="chevronDown" size="xs" aria-hidden="true" />
        </button>
        <button type="button" className="global-user-card__more" aria-label="Open user menu" title="User menu" onClick={onOpenUserMenu}>
          <AppIcon name="more" size="sm" />
        </button>
      </div>

      <PresenceMenu
        open={presenceOpen}
        preference={presence.preference}
        boundaryRef={rootRef}
        triggerRef={presenceTriggerRef}
        onChange={globalPresenceService.setPreference}
        onClose={closePresence}
      />
    </footer>
  );
}
