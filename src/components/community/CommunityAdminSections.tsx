import { useEffect, useState, type ReactNode } from "react";
import type { Community } from "../../types/community";
import type { CommunityAccess } from "../../types/communityAccess";
import { reportService } from "../../services/reportService";
import { messageModerationFilterService } from "../../services/messageModerationFilterService";
import { AppIcon, type IconName } from "../AppIcon";
import { MemberAvatar } from "../MemberAvatar";

export type AdminSectionId = "overview" | "community-settings" | "channels" | "roles" | "members" | "invites" | "events" | "moderation" | "audit-log" | "danger-zone";
export type ModeratorSectionId = "reports" | "flagged-messages" | "member-moderation" | "message-moderation" | "moderation-log";

export const adminSectionDefinitions: Array<{ id: AdminSectionId; label: string; permission?: CommunityAccess["permissions"][number]; ownerOnly?: boolean; icon: IconName }> = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "community-settings", label: "Community Settings", permission: "manageCommunity", icon: "settings" },
  { id: "channels", label: "Channels", permission: "manageChannels", icon: "hash" },
  { id: "roles", label: "Roles", permission: "manageRoles", icon: "lock" },
  { id: "members", label: "Members", permission: "manageMembers", icon: "users" },
  { id: "invites", label: "Invites", permission: "createInvites", icon: "send" },
  { id: "events", label: "Events", permission: "manageCommunity", icon: "bell" },
  { id: "moderation", label: "Moderation", permission: "moderateMessages", icon: "bell" },
  { id: "audit-log", label: "Audit Log", permission: "viewAuditLog", icon: "inbox" },
  { id: "danger-zone", label: "Danger Zone", ownerOnly: true, icon: "trash" },
];

export const moderatorSectionDefinitions: Array<{ id: ModeratorSectionId; label: string; permission: CommunityAccess["permissions"][number]; icon: IconName }> = [
  { id: "reports", label: "Reports", permission: "moderateMessages", icon: "bell" },
  { id: "flagged-messages", label: "Flagged messages", permission: "moderateMessages", icon: "inbox" },
  { id: "member-moderation", label: "Member moderation", permission: "manageMembers", icon: "users" },
  { id: "message-moderation", label: "Message moderation", permission: "moderateMessages", icon: "hash" },
  { id: "moderation-log", label: "Moderation log", permission: "moderateMessages", icon: "settings" },
];

function SectionShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <section className="community-admin-section"><header><p className="eyebrow">{eyebrow}</p><h3>{title}</h3><span>{description}</span></header>{children}</section>;
}

export function CommunityAdminOverview({ community, access }: { community: Community; access: CommunityAccess }) {
  const channels = community.categories.flatMap((category) => category.channels);
  return <SectionShell eyebrow="Workspace health" title={`${community.name} overview`} description={`Signed in with ${access.status} access.`}><div className="community-admin-metrics"><article><strong>{community.members.length}</strong><span>Members</span></article><article><strong>{channels.length}</strong><span>Channels</span></article><article><strong>{community.roles.length}</strong><span>Roles</span></article><article><strong>{community.messages.length}</strong><span>Mock messages</span></article></div><div className="community-admin-note"><AppIcon name="lock" size="sm" /><span>Frontend section visibility improves UX. Supabase RLS remains the authorization boundary.</span></div></SectionShell>;
}

export function CommunitySettingsSection({ community, onPlaceholderAction }: { community: Community; onPlaceholderAction: (message: string) => void }) {
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description ?? "");
  return <SectionShell eyebrow="Community identity" title="Community settings" description="Edit a local draft without bypassing the backend source of truth."><div className="community-settings-form"><label><span>Name</span><input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} /></label><label><span>Description</span><textarea rows={4} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} /></label><button type="button" disabled={!name.trim()} onClick={() => onPlaceholderAction("Community settings draft is ready. Supabase save remains permission-enforced.")}><AppIcon name="send" size="sm" /> Save draft</button></div></SectionShell>;
}

export function CommunityChannelsSection({ community, onCreateChannel }: { community: Community; onCreateChannel: (categoryId: string) => void }) {
  return <SectionShell eyebrow="Structure" title="Channels" description="Create channels through the existing validated channel modal."><div className="community-admin-list">{community.categories.map((category) => <article key={category.id}><div><strong>{category.name}</strong><span>{category.channels.length} channels</span></div><button type="button" onClick={() => onCreateChannel(category.id)}><AppIcon name="plus" size="sm" /> Add channel</button></article>)}</div></SectionShell>;
}

export function CommunityRolesSection({ community }: { community: Community }) {
  return <SectionShell eyebrow="Access" title="Roles" description="Role order and badges currently follow the community mock/API data source."><div className="community-role-grid">{[...community.roles].sort((a, b) => b.level - a.level).map((role) => <article key={role.id}><i style={{ background: role.color }} /><div><strong>{role.name}</strong><span>Level {role.level}</span></div></article>)}</div></SectionShell>;
}

export function CommunityMembersSection({ community }: { community: Community }) {
  return <SectionShell eyebrow="People" title="Members" description="Safe member identity and assigned role preview."><div className="community-admin-member-list">{community.members.map((member) => { const role = community.roles.find((candidate) => candidate.id === member.roleId); return <article key={member.id}><MemberAvatar member={member} size={36} /><div><strong>{member.displayName}</strong><span>@{member.username}</span></div><em>{role?.name ?? "Member"}</em></article>; })}</div></SectionShell>;
}

export function CommunityInvitesSection({ onOpenInvite }: { onOpenInvite: () => void }) {
  return <SectionShell eyebrow="Access links" title="Invites" description="Create limited, expiring links. Invite validation remains server-enforced."><div className="community-admin-empty"><AppIcon name="send" size="lg" /><strong>Create an invite</strong><span>Use limits and expiry are available in the invite modal.</span><button type="button" onClick={onOpenInvite}>Open invite creator</button></div></SectionShell>;
}

export function CommunityModerationSection({ children }: { children?: ReactNode }) {
  return <SectionShell eyebrow="Safety" title="Moderation" description="Community-level controls only. No platform or enterprise administration is included.">{children ?? <div className="community-admin-empty"><AppIcon name="bell" size="lg" /><strong>No additional moderation tools</strong><span>Reports and filters appear here when available.</span></div>}</SectionShell>;
}

export function CommunityDangerZone({ children }: { children?: ReactNode }) {
  return <SectionShell eyebrow="Owner only" title="Danger zone" description="Destructive actions require explicit confirmation and remain auditable."><div className="community-danger-grid">{children}</div></SectionShell>;
}

export function CommunityAuditLogPlaceholder() {
  return <SectionShell eyebrow="Audit" title="Audit log" description="Append-only community audit retrieval remains a backend placeholder for beta."><div className="community-admin-empty"><AppIcon name="inbox" size="lg" /><strong>No audit entries loaded</strong><span>Tokens, passwords, and private message content must never be recorded here.</span></div></SectionShell>;
}

export function ModeratorReportsSection({ communityId, canReview }: { communityId: string; canReview: boolean }) {
  const [reports, setReports] = useState(() => reportService.listReports(communityId));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; void reportService.listCommunityReports(communityId, canReview).then((result) => { if (!active) return; if (result.ok) setReports(result.data); else setError(result.message); }); return () => { active = false; }; }, [canReview, communityId]);
  const update = async (reportId: string, status: "reviewed" | "dismissed" | "action_taken") => { const result = await reportService.updateReportStatus({ reportId, status }); if (result.ok) setReports((items) => items.map((item) => item.id === reportId ? result.data : item)); else setError(result.message); };
  const summary = reports.reduce((value, report) => ({ ...value, [report.status]: value[report.status] + 1 }), { open: 0, reviewed: 0, dismissed: 0, action_taken: 0 });
  return <SectionShell eyebrow="Moderation queue" title="Reports" description="Only moderators, admins, and owners can review this community queue."><div className="community-admin-metrics"><article><strong>{summary.open}</strong><span>Open</span></article><article><strong>{summary.reviewed}</strong><span>Reviewed</span></article><article><strong>{summary.action_taken}</strong><span>Action taken</span></article></div>{error ? <p className="moderation-queue-error" role="alert">{error}</p> : null}{reports.length ? <div className="community-admin-list moderation-report-list">{reports.map((report) => <article key={report.id}><div><strong>{report.reason}</strong><span>{report.targetType} · {report.status}</span><small>{report.description}</small></div><div className="moderation-report-actions"><button type="button" disabled={!canReview || report.status !== "open"} onClick={() => void update(report.id, "reviewed")}>Reviewed</button><button type="button" disabled={!canReview || report.status !== "open"} onClick={() => void update(report.id, "dismissed")}>Dismiss</button><button type="button" disabled={!canReview || report.status !== "open"} onClick={() => void update(report.id, "action_taken")}>Action taken</button></div></article>)}</div> : <div className="community-admin-empty"><AppIcon name="bell" size="lg" /><strong>No reports</strong><span>New reports appear here without exposing unrelated private content.</span></div>}</SectionShell>;
}

export function ModeratorMessagesSection({ community, title = "Message moderation" }: { community: Community; title?: string }) {
  return <SectionShell eyebrow="Message safety" title={title} description="Recent message context for permitted moderation actions."><div className="community-admin-list">{community.messages.slice(-6).reverse().map((message) => <article key={message.id}><div><strong>{message.deletedAt ? "Deleted message" : message.body.slice(0, 90) || "Attachment message"}</strong><span>{message.channelId} · {message.createdAt}</span></div><button type="button" disabled title="Requires a confirmed moderation reason">Delete with reason</button></article>)}</div></SectionShell>;
}

export function ModeratorBlockedItemsSection({ communityId }: { communityId: string }) {
  const items = messageModerationFilterService.getRecentBlockedItems(communityId);
  return <SectionShell eyebrow="Prevented activity" title="Recent blocked items" description="Rule metadata only; blocked message content is not retained.">{items.length ? <div className="community-admin-list">{items.map((item) => <article key={item.id}><div><strong>{item.rule.replace(/_/g, " ")}</strong><span>{item.reason} · {item.createdAt}</span></div><button type="button" disabled>Timeout placeholder</button></article>)}</div> : <div className="community-admin-empty"><AppIcon name="lock" size="lg" /><strong>No blocked items</strong><span>Blocked-word, mention, link, and slow-mode events will appear here without message content.</span></div>}</SectionShell>;
}

export function ModeratorMembersSection({ community }: { community: Community }) {
  return <SectionShell eyebrow="Member safety" title="Member moderation" description="Member actions remain permission checked and require confirmation."><div className="community-admin-member-list">{community.members.slice(0, 12).map((member) => <article key={member.id}><MemberAvatar member={member} size={36} /><div><strong>{member.displayName}</strong><span>{member.statusText}</span></div><div className="moderation-member-actions"><button type="button" disabled>Timeout</button><button type="button" disabled>Kick</button><button type="button" disabled>Ban</button></div></article>)}</div></SectionShell>;
}

export function ModeratorLogPlaceholder() {
  return <SectionShell eyebrow="Moderation history" title="Moderation log" description="Append-only moderation history remains a backend placeholder."><div className="community-admin-empty"><AppIcon name="inbox" size="lg" /><strong>No moderation events loaded</strong><span>Future entries must respect audit immutability and redaction rules.</span></div></SectionShell>;
}
