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
    <footer ref={rootRef} className="global-user-card" style={{ position: "relative" }}>
      <button type="button" className="global-user-card__identity" aria-label={`Open profile for ${currentUser.displayName}`} title={compact ? currentUser.displayName : undefined} onClick={onOpenProfile}>
        <span className="global-user-card__avatar"><MemberAvatar member={currentUser} size={36} /><i className={`global-presence-dot is-${presence.dotStatus}`} aria-label={`Presence: ${presence.label}`} /></span>
        <span className="global-user-card__copy">
          <span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 4 }}><strong title={currentUser.displayName}>{currentUser.displayName}</strong><VerifiedBadge verification={currentUser.verification} size="xs" /></span>
        </span>
      </button>
      <button type="button" className="global-user-card__more" aria-label="Open user menu" title={compact ? "User menu" : undefined} onClick={onOpenUserMenu}><AppIcon name="more" size="sm" /></button>
      <button
        ref={presenceTriggerRef}
        type="button"
        className="global-user-card__more"
        style={{ gridColumn: "1 / -1", width: "100%", height: 27, display: "flex", justifyContent: compact ? "center" : "flex-start", gap: 7, paddingInline: compact ? 0 : 8 }}
        aria-label={`Change presence. Current presence: ${presence.label}`}
        aria-haspopup="menu"
        aria-expanded={presenceOpen}
        title={presence.label}
        onClick={() => setPresenceOpen((value) => !value)}
      >
        <i className={`global-presence-dot is-${presence.dotStatus}`} style={{ position: "static", display: "block", flex: "0 0 auto", borderColor: "transparent" }} aria-hidden="true" />
        {!compact ? <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-muted)", fontSize: 10, fontWeight: 700 }}>{presence.label}</span> : null}
        <AppIcon name="chevronDown" size="xs" />
      </button>
      <PresenceMenu open={presenceOpen} compact={compact} preference={presence.preference} boundaryRef={rootRef} onChange={globalPresenceService.setPreference} onClose={closePresence} />
    </footer>
  );
}
