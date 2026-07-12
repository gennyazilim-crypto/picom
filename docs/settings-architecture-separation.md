# User and community settings separation

Picom treats user preferences and community administration as separate products with separate entry paths and state namespaces.

## User Settings

The only visible entry is **Settings** in the authenticated global sidebar. Opening it creates a request whose source is `global-sidebar`, resets the initial modal section to Account, closes transient overlays, and opens the user Settings modal.

Canonical user sections are Account, Profile, Privacy & Safety, Appearance, Accessibility, Notifications, Voice & Audio, Keyboard, Advanced, and Diagnostics. The current modal retains internal compatibility aliases for Accessibility, Voice & Audio, and Keyboard while those panels are consolidated.

Removed entry points include `Ctrl+,`, command palette Settings, `picom://settings`, native app-menu Settings, tray Settings, profile Edit/Verification buttons, profile overflow Settings links, ServerRail, and CommunitySidebar/UserMiniCard.

Help & Support is not a Settings section. Its dedicated global workspace is owned by the following support task.

## Community settings

The sole entry is Community Header -> Community Menu. The centralized destination policy resolves Owner/Admin to the admin panel, Moderator to the moderator panel, Member to the member menu, and Visitor to the visitor menu. Panel-level permission checks and backend RLS remain authoritative.

Canonical community areas are Overview & Branding, Roles, Members, Channels & Sections, Invites, Moderation, Audit, Danger Zone, and type-specific Text/Radio/Podcast settings.

## State isolation

User Settings uses the user settings modal and `settingsService` namespace. Community panel section state remains local to `CommunitySidebar`/`CommunityMenu`. No community panel writes the user Settings initial-section key, and closing either workspace does not restore the other.
