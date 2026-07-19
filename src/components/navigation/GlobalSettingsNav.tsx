import { useEffect, useState } from "react";
import type { IconName } from "../AppIcon";
import { AppIcon } from "../AppIcon";
import type { UserSettingsSection } from "../../services/navigation/settingsNavigationPolicyService";

export type SettingsNavChild = Readonly<{
  section: UserSettingsSection;
  label: string;
  icon: IconName;
}>;

/** Nested items under Settings — maps 1:1 to existing modal sections. */
export const GLOBAL_SETTINGS_NAV_CHILDREN: readonly SettingsNavChild[] = [
  { section: "Account", label: "Account", icon: "user" },
  { section: "Profile", label: "Profile", icon: "users" },
  { section: "Privacy & Safety", label: "Privacy & Safety", icon: "lock" },
  { section: "Appearance", label: "Appearance", icon: "sun" },
  { section: "Notifications", label: "Notifications", icon: "bell" },
  { section: "Voice & Audio", label: "Voice & Audio", icon: "microphone" },
  { section: "Advanced", label: "Advanced", icon: "settings" },
];

type GlobalSettingsNavProps = Readonly<{
  compact: boolean;
  settingsOpen: boolean;
  activeSection: UserSettingsSection | null;
  onOpenSection: (section: UserSettingsSection) => void;
}>;

export function GlobalSettingsNav({ compact, settingsOpen, activeSection, onOpenSection }: GlobalSettingsNavProps) {
  const [expanded, setExpanded] = useState(settingsOpen);

  useEffect(() => {
    if (settingsOpen) setExpanded(true);
  }, [settingsOpen]);

  useEffect(() => {
    if (compact) setExpanded(false);
  }, [compact]);

  const parentActive = settingsOpen || expanded;

  if (compact) {
    return (
      <button
        type="button"
        className={`global-nav-item${settingsOpen ? " is-active" : ""}`}
        data-global-navigation-button="true"
        aria-label="Open user settings"
        aria-current={settingsOpen ? "page" : undefined}
        title="Settings"
        onClick={() => onOpenSection("Account")}
      >
        <span className="global-nav-item__icon" aria-hidden="true">
          <AppIcon name="settings" size="lg" />
        </span>
        <span className="global-nav-item__label">Settings</span>
      </button>
    );
  }

  return (
    <div className={`global-settings-nav${expanded ? " is-expanded" : ""}${parentActive ? " is-active" : ""}`}>
      <button
        type="button"
        className={`global-nav-item global-settings-nav__parent${parentActive ? " is-active" : ""}`}
        data-global-navigation-button="true"
        aria-label="Settings"
        aria-expanded={expanded}
        aria-controls="global-settings-submenu"
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="global-nav-item__icon" aria-hidden="true">
          <AppIcon name="settings" size="lg" />
        </span>
        <span className="global-nav-item__label">Settings</span>
        <span className={`global-settings-nav__chevron${expanded ? " is-open" : ""}`} aria-hidden="true">
          <AppIcon name="chevronDown" size="sm" />
        </span>
      </button>

      {expanded ? (
        <div id="global-settings-submenu" className="global-settings-nav__children" role="group" aria-label="Settings sections">
          {GLOBAL_SETTINGS_NAV_CHILDREN.map((child) => {
            const childActive = settingsOpen && activeSection === child.section;
            return (
              <button
                key={child.section}
                type="button"
                className={`global-settings-nav__child${childActive ? " is-active" : ""}`}
                data-global-navigation-button="true"
                aria-label={`Open ${child.label} settings`}
                aria-current={childActive ? "page" : undefined}
                onClick={() => onOpenSection(child.section)}
              >
                <span className="global-settings-nav__child-icon" aria-hidden="true">
                  <AppIcon name={child.icon} size="sm" />
                </span>
                <span className="global-settings-nav__child-label">{child.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
