import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Community, Member } from "../types/community";
import type { CommunityAccess, CommunityMenuActionId, CommunityMenuItemDescriptor } from "../types/communityAccess";
import { getCommunityMenuItems } from "../services/community/communityMenuService";
import { clipboardService } from "../services/clipboardService";
import { AppIcon } from "./AppIcon";
import {
  adminSectionDefinitions,
  moderatorSectionDefinitions,
  CommunityAdminOverview,
  CommunityAuditLogPlaceholder,
  CommunityChannelsSection,
  CommunityDangerZone,
  CommunityInvitesSection,
  CommunityMembersSection,
  CommunityModerationSection,
  CommunityRolesSection,
  CommunitySettingsSection,
  ModeratorLogPlaceholder,
  ModeratorMembersSection,
  ModeratorMessagesSection,
  ModeratorReportsSection,
  type AdminSectionId,
  type ModeratorSectionId,
} from "./community/CommunityAdminSections";

type MenuCallbacks = {
  onOpenAdminPanel: () => void;
  onOpenModeratorPanel: () => void;
  onOpenMemberPanel: () => void;
  onOpenVisitorPanel: () => void;
  onOpenJoinCommunity: () => void;
  onOpenLeaveCommunity: () => void;
  onOpenInvitePeople: () => void;
  onPlaceholderAction: (message: string) => void;
};

type CommunityMenuProps = {
  community: Community;
  access: CommunityAccess;
  callbacks: MenuCallbacks;
  onClose: () => void;
};

export function PermissionGate({ allowed, children, fallback = null }: { allowed: boolean; children: ReactNode; fallback?: ReactNode }) {
  return allowed ? <>{children}</> : <>{fallback}</>;
}

export function CommunityRoleBadge({ access }: { access: CommunityAccess }) {
  return <span className={`community-role-badge ${access.status}`}>{access.status}</span>;
}

export function JoinCommunityButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button className="join-community-button" type="button" onClick={onClick} disabled={disabled}>
      <AppIcon name="plus" size="sm" />
      Join Community
    </button>
  );
}

function actionDescription(item: CommunityMenuItemDescriptor, access: CommunityAccess): string | undefined {
  if (item.description) return item.description;
  if (item.permission && !access.permissions.includes(item.permission)) return "Permission required.";
  return undefined;
}

function handleCommunityAction(item: CommunityMenuItemDescriptor, community: Community, callbacks: MenuCallbacks, close: () => void) {
  const actionMap: Partial<Record<CommunityMenuActionId, () => void>> = {
    "community-settings": callbacks.onOpenAdminPanel,
    "admin-panel": callbacks.onOpenAdminPanel,
    "manage-channels": callbacks.onOpenAdminPanel,
    "manage-roles": callbacks.onOpenAdminPanel,
    "manage-members": callbacks.onOpenAdminPanel,
    "audit-log": callbacks.onOpenAdminPanel,
    "transfer-ownership": callbacks.onOpenAdminPanel,
    "delete-community": callbacks.onOpenAdminPanel,
    "moderator-panel": callbacks.onOpenModeratorPanel,
    "community-info": callbacks.onOpenMemberPanel,
    "notification-settings": callbacks.onOpenMemberPanel,
    "join-community": callbacks.onOpenJoinCommunity,
    "leave-community": callbacks.onOpenLeaveCommunity,
    "invite-people": callbacks.onOpenInvitePeople,
    "copy-community-link": () => {
      void clipboardService.copyText(`picom://community/${community.id}`).then((result) => {
        callbacks.onPlaceholderAction(result.ok ? "Community link copied." : result.reason);
      });
    },
    "report-community": () => callbacks.onPlaceholderAction("Use Settings > Privacy & Safety to report this community."),
  };

  actionMap[item.id]?.();
  close();
}

export function CommunityMenuItem({ item, access, onSelect }: { item: CommunityMenuItemDescriptor; access: CommunityAccess; onSelect: () => void }) {
  const disabled = item.disabled || Boolean(item.permission && !access.permissions.includes(item.permission));
  const description = actionDescription(item, access);

  return (
    <button className={`community-menu-item ${item.tone === "danger" ? "danger" : ""}`} type="button" disabled={disabled} onClick={onSelect}>
      <span>{item.label}</span>
      {description ? <small>{description}</small> : null}
    </button>
  );
}

export function CommunityMemberMenu({ community, access }: { community: Community; access: CommunityAccess }) {
  return (
    <div className="community-menu-info-card">
      <strong>{community.name}</strong>
      <span>{community.description ?? "Picom community workspace."}</span>
      <small>{access.status === "visitor" ? "Public preview" : "Member tools"}</small>
    </div>
  );
}

export function CommunityVisitorMenu({ community, access, onJoin }: { community: Community; access: CommunityAccess; onJoin: () => void }) {
  return (
    <div className="community-menu-info-card visitor">
      <strong>{community.name}</strong>
      <span>You can view public content, but join to participate.</span>
      <small>{access.visibility === "public" ? "Public community" : "Private community"}</small>
      <JoinCommunityButton onClick={onJoin} disabled={!access.canJoin} />
    </div>
  );
}

export function CommunityMenu({ community, access, callbacks, onClose }: CommunityMenuProps) {
  const items = getCommunityMenuItems(access);

  useEffect(() => {
    const close = () => onClose();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <section className="community-menu-popover" role="menu" aria-label={`${community.name} menu`} onPointerDown={(event) => event.stopPropagation()}>
      <header>
        <div className="community-menu-mark" style={{ background: community.accentColor }}>{community.icon}</div>
        <div>
          <strong>{community.name}</strong>
          <span>{access.isVisitor ? "Visitor preview" : "Community controls"}</span>
        </div>
        <CommunityRoleBadge access={access} />
      </header>

      {access.isVisitor ? <CommunityVisitorMenu community={community} access={access} onJoin={callbacks.onOpenJoinCommunity} /> : <CommunityMemberMenu community={community} access={access} />}

      <div className="community-menu-list">
        {items.map((item) => (
          <CommunityMenuItem key={item.id} item={item} access={access} onSelect={() => handleCommunityAction(item, community, callbacks, onClose)} />
        ))}
      </div>
    </section>
  );
}

function ModalShell({ title, eyebrow, onClose, children, className = "" }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode; className?: string }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className={`community-access-modal ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby="community-access-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button modal-close" type="button" aria-label="Close" onClick={onClose}>
          <AppIcon name="close" size="lg" />
        </button>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id="community-access-modal-title">{title}</h2>
        {children}
      </section>
    </div>
  );
}

export function CommunityAdminPanel({ community, access, onClose, onOpenInvite, onCreateChannel, onPlaceholderAction, sectionTools }: { community: Community; access: CommunityAccess; onClose: () => void; onOpenInvite: () => void; onCreateChannel: (categoryId: string) => void; onPlaceholderAction: (message: string) => void; sectionTools?: Partial<Record<AdminSectionId, ReactNode>> }) {
  const [activeSection, setActiveSection] = useState<AdminSectionId>("overview");
  const sections = adminSectionDefinitions.filter((section) => {
    if (section.ownerOnly) return access.isOwner;
    return !section.permission || access.permissions.includes(section.permission);
  });

  if (!access.canOpenAdminPanel) {
    return <ModalShell title="Community management unavailable" eyebrow="Permission denied" onClose={onClose}><div className="auth-error">Owner or admin access is required.</div></ModalShell>;
  }

  const sectionContent = (() => {
    if (activeSection === "overview") return <CommunityAdminOverview community={community} access={access} />;
    if (activeSection === "community-settings") return <CommunitySettingsSection community={community} onPlaceholderAction={onPlaceholderAction} />;
    if (activeSection === "channels") return <CommunityChannelsSection community={community} onCreateChannel={onCreateChannel} />;
    if (activeSection === "roles") return <CommunityRolesSection community={community} />;
    if (activeSection === "members") return <CommunityMembersSection community={community} />;
    if (activeSection === "invites") return <CommunityInvitesSection onOpenInvite={onOpenInvite} />;
    if (activeSection === "moderation") return <CommunityModerationSection>{sectionTools?.moderation}</CommunityModerationSection>;
    if (activeSection === "audit-log") return <CommunityAuditLogPlaceholder />;
    return <CommunityDangerZone>{sectionTools?.["danger-zone"]}</CommunityDangerZone>;
  })();

  return (
    <ModalShell title={`${community.name} management center`} eyebrow="Community administration" onClose={onClose} className="community-management-modal">
      <div className="community-admin-panel">
        <nav aria-label="Community admin sections">
          {sections.map((section) => {
            return (
              <button key={section.id} className={activeSection === section.id ? "active" : ""} onClick={() => setActiveSection(section.id)}>
                <AppIcon name={section.icon} size="sm" /> {section.label}
              </button>
            );
          })}
        </nav>
        <div className="community-admin-content">
          {sectionContent}
          {activeSection !== "moderation" && activeSection !== "danger-zone" ? sectionTools?.[activeSection] : null}
        </div>
      </div>
    </ModalShell>
  );
}

export function CommunityModeratorPanel({ community, access, onClose, onOpenInvite }: { community: Community; access: CommunityAccess; onClose: () => void; onOpenInvite: () => void }) {
  const [activeSection, setActiveSection] = useState<ModeratorSectionId>("reports");

  if (!access.canOpenModeratorPanel) {
    return <ModalShell title="Moderator panel unavailable" eyebrow="Permission denied" onClose={onClose}><div className="auth-error">Moderator access is required.</div></ModalShell>;
  }

  const content = activeSection === "reports"
    ? <ModeratorReportsSection />
    : activeSection === "flagged-messages"
      ? <ModeratorMessagesSection community={community} title="Flagged messages" />
      : activeSection === "member-moderation"
        ? <ModeratorMembersSection community={community} />
        : activeSection === "message-moderation"
          ? <ModeratorMessagesSection community={community} />
          : <ModeratorLogPlaceholder />;

  return (
    <ModalShell title={`${community.name} moderator panel`} eyebrow="Moderation" onClose={onClose} className="community-management-modal">
      <div className="community-admin-panel moderator-admin-panel">
        <nav aria-label="Moderator sections">
          {moderatorSectionDefinitions.map((section) => <button key={section.id} className={activeSection === section.id ? "active" : ""} onClick={() => setActiveSection(section.id)}><AppIcon name={section.icon} size="sm" /> {section.label}</button>)}
        </nav>
        <div className="community-admin-content">{content}</div>
      </div>
      {access.permissions.includes("createInvites") ? <button type="button" className="moderator-invite-action" onClick={onOpenInvite}><AppIcon name="users" size="sm" /> Invite people</button> : null}
    </ModalShell>
  );
}

export function CommunityMemberPanel({ community, access, onClose, onOpenLeave, onOpenInvite }: { community: Community; access: CommunityAccess; onClose: () => void; onOpenLeave: () => void; onOpenInvite: () => void }) {
  return (
    <ModalShell title={`${community.name} member menu`} eyebrow="Community menu" onClose={onClose}>
      <div className="community-confirm-panel">
        <CommunityMemberMenu community={community} access={access} />
        <div className="community-panel-list">
          <article><strong>Notification settings</strong><span>Notification preferences are managed locally in this beta.</span></article>
          {access.permissions.includes("createInvites") ? <button type="button" className="community-panel-action" onClick={onOpenInvite}><strong>Invite people</strong><span>Create a limited Picom invite link.</span></button> : null}
          <article><strong>Report community</strong><span>Submit reports from Settings &gt; Privacy &amp; Safety without exposing unrelated private content.</span></article>
        </div>
        <div className="modal-actions-row">
          <button className="secondary-action" type="button" onClick={onClose}>Close</button>
          <button className="danger-action" type="button" disabled={!access.canLeave} onClick={onOpenLeave}>Leave community</button>
        </div>
      </div>
    </ModalShell>
  );
}

export function CommunityVisitorPanel({ community, access, isAuthenticated, onClose, onOpenJoin, onOpenJoinWithInvite }: { community: Community; access: CommunityAccess; isAuthenticated: boolean; onClose: () => void; onOpenJoin: () => void; onOpenJoinWithInvite: () => void }) {
  return (
    <ModalShell title={`${community.name} public preview`} eyebrow="Visitor menu" onClose={onClose}>
      <div className="community-confirm-panel">
        <CommunityVisitorMenu community={community} access={access} onJoin={onOpenJoin} />
        <div className="community-panel-list">
          <article><strong>Public channels visible</strong><span>Private channels and member-only data stay hidden.</span></article>
          <article><strong>Join to participate</strong><span>Visitors cannot send messages, react, or upload attachments.</span></article>
          <article><strong>{isAuthenticated ? "Ready to join" : "Sign in required"}</strong><span>{isAuthenticated ? "Confirm the join flow to become a member." : "Sign in or register before joining."}</span></article>
        </div>
        <div className="modal-actions-row"><button type="button" className="secondary-action" disabled={!isAuthenticated} onClick={onOpenJoinWithInvite}>Join with invite</button></div>
      </div>
    </ModalShell>
  );
}

export function CommunityJoinModal({ community, isAuthenticated, onClose, onConfirm }: { community: Community; isAuthenticated: boolean; onClose: () => void; onConfirm: () => void | Promise<void> }) {
  const [joining, setJoining] = useState(false);

  return (
    <ModalShell title={`Join ${community.name}`} eyebrow="Community access" onClose={onClose}>
      <div className="community-confirm-panel">
        <p>{community.description ?? "Join this Picom community to participate in public channels."}</p>
        <dl>
          <div><dt>Members</dt><dd>{community.members.length}</dd></div>
          <div><dt>Visibility</dt><dd>{community.visibility ?? "private"}</dd></div>
          <div><dt>Rules</dt><dd>Community rules are not published for this beta.</dd></div>
        </dl>
        {!isAuthenticated ? <div className="auth-error">Sign in or register before joining.</div> : null}
        <div className="modal-actions-row">
          <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
          <button
            className="send-button"
            type="button"
            disabled={!isAuthenticated || joining}
            onClick={async () => {
              setJoining(true);
              await onConfirm();
              setJoining(false);
            }}
          >
            <AppIcon name="plus" size="sm" />
            {joining ? "Joining..." : "Join"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function CommunityLeaveModal({ community, access, onClose, onConfirm }: { community: Community; access: CommunityAccess; onClose: () => void; onConfirm: () => void | Promise<void> }) {
  const [leaving, setLeaving] = useState(false);

  return (
    <ModalShell title={`Leave ${community.name}`} eyebrow="Leave community" onClose={onClose}>
      <div className="community-confirm-panel">
        <p>Leaving removes your membership locally. If the community is public, you may still see public read-only content.</p>
        {access.isOwner ? <div className="auth-error">Owners must transfer ownership before leaving.</div> : null}
        <div className="modal-actions-row">
          <button className="secondary-action" type="button" onClick={onClose}>Cancel</button>
          <button
            className="danger-action"
            type="button"
            disabled={!access.canLeave || leaving}
            onClick={async () => {
              setLeaving(true);
              await onConfirm();
              setLeaving(false);
            }}
          >
            Leave community
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
