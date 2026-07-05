import { useState } from "react";
import type { Member } from "../types/community";
import { AppIcon } from "./AppIcon";

interface AppLockScreenProps {
  currentUser: Member;
  onUnlock: () => void;
  onLogout: () => void;
}

export function AppLockScreen({ currentUser, onUnlock, onLogout }: AppLockScreenProps) {
  const [unlockText, setUnlockText] = useState("");
  const canUnlock = unlockText.trim().length > 0;
  const initials = currentUser.displayName.slice(0, 2).toUpperCase();

  return (
    <div className="app-lock-backdrop" role="dialog" aria-modal="true" aria-label="Picom app locked">
      <section className="app-lock-card">
        <div className="app-lock-brand">
          <span className="app-lock-logo"><AppIcon name="lock" size="xl" /></span>
          <div>
            <span className="eyebrow">Quick lock</span>
            <h2>Picom is locked</h2>
          </div>
        </div>

        <div className="app-lock-user">
          <span className="app-lock-avatar" aria-hidden="true">
            {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} alt="" /> : initials}
          </span>
          <div>
            <strong>{currentUser.displayName}</strong>
            <span>@{currentUser.username}</span>
          </div>
        </div>

        <p>
          Your desktop session is still active, but chat content is hidden until you unlock this local view.
          Password re-authentication is a future Supabase step and no password is stored locally.
        </p>

        <label className="app-lock-field">
          <span>Unlock placeholder</span>
          <input
            value={unlockText}
            onChange={(event) => setUnlockText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canUnlock) onUnlock();
            }}
            autoFocus
            placeholder="Type anything to unlock locally"
          />
        </label>

        <div className="app-lock-actions">
          <button type="button" onClick={onUnlock} disabled={!canUnlock}>Unlock locally</button>
          <button type="button" className="secondary" onClick={onLogout}>Log out</button>
        </div>
      </section>
    </div>
  );
}
