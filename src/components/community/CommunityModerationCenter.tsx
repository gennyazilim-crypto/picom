import { useEffect, useMemo, useState } from "react";
import type { Community, Member } from "../../types/community";
import type { CommunityAccess } from "../../types/communityAccess";
import type { CommunityModerationState, MemberModerationAction } from "../../types/memberModeration";
import type { ReportRecord, ReportStatus } from "../../types/reports";
import type { AuditLogRecord } from "../../types/auditLog";
import { canModerateCommunityMember } from "../../services/permissions/communityPermissions";
import { memberManagementService } from "../../services/memberManagementService";
import { reportService } from "../../services/reportService";
import { auditLogService } from "../../services/auditLogService";
import { dateTimeService } from "../../services/dateTimeService";
import { MemberModerationModal } from "../MemberModerationModal";
import { MemberAvatar } from "../MemberAvatar";
import { AppIcon } from "../AppIcon";
import "./CommunityModerationCenter.css";

export type CommunityModerationMode = "all" | "reports" | "members" | "messages" | "log";
type Props = Readonly<{ community: Community; access: CommunityAccess; mode: CommunityModerationMode; onMembersChanged: (members: Member[]) => void; onOpenSource: (report: ReportRecord) => void }>;
type PendingReverse = Readonly<{ state: CommunityModerationState; action: "unban" | "untimeout" }>;

export function CommunityModerationCenter({ community, access, mode, onMembersChanged, onOpenSource }: Props) {
  const [query, setQuery] = useState("");
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [states, setStates] = useState<CommunityModerationState[]>([]);
  const [audit, setAudit] = useState<AuditLogRecord[]>([]);
  const [reviewReason, setReviewReason] = useState("");
  const [pendingMember, setPendingMember] = useState<{ member: Member; action: "timeout" | "kick" | "ban" } | null>(null);
  const [pendingReverse, setPendingReverse] = useState<PendingReverse | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const canManageMembers = access.permissions.includes("manageMembers");
  const canReview = access.permissions.includes("moderateMessages");
  const showReports = mode === "all" || mode === "reports" || mode === "messages";
  const showMembers = mode === "all" || mode === "members";
  const showLog = mode === "all" || mode === "log";

  const refreshRestrictions = async () => {
    const result = await memberManagementService.listModerationStates(community.id, canManageMembers);
    if (result.ok) setStates(result.data); else if (showMembers) setNotice({ error: true, text: result.message });
  };

  useEffect(() => {
    let active = true; setNotice(null);
    if (showReports) void reportService.listCommunityReports(community.id, canReview).then((result) => { if (!active) return; if (result.ok) setReports(result.data); else setNotice({ error: true, text: result.message }); });
    if (showMembers) void memberManagementService.listModerationStates(community.id, canManageMembers).then((result) => { if (!active) return; if (result.ok) setStates(result.data); else setNotice({ error: true, text: result.message }); });
    if (showLog) void auditLogService.list(community.id, access.permissions.includes("viewAuditLog")).then((result) => { if (!active) return; if (result.ok) setAudit(result.data.filter((item) => item.actionType === "moderation_action").slice(0, 50)); });
    return () => { active = false; };
  }, [access.permissions, canManageMembers, canReview, community.id, showLog, showMembers, showReports]);

  const visibleMembers = useMemo(() => { const needle = query.trim().toLowerCase(); return community.members.filter((member) => !needle || member.displayName.toLowerCase().includes(needle) || member.username.toLowerCase().includes(needle)); }, [community.members, query]);
  const contentReports = useMemo(() => reports.filter((report) => mode !== "messages" || ["message", "radio_session", "podcast_episode", "podcast_comment"].includes(report.targetType)), [mode, reports]);

  const updateReport = async (report: ReportRecord, status: ReportStatus) => {
    if (busy || reviewReason.trim().length < 3 || !reportService.canTransitionReportStatus(report.status, status)) return;
    setBusy(true); setNotice(null);
    const result = await reportService.updateReportStatus({ reportId: report.id, status, canReview, reviewedById: access.userId, reviewReason });
    setBusy(false);
    if (!result.ok) { setNotice({ error: true, text: result.message }); return; }
    setReports((current) => current.map((item) => item.id === report.id ? result.data : item)); setReviewReason(""); setNotice({ error: false, text: `Report moved to ${status.replace("_", " ")}.` });
  };

  const applyMemberAction = async (member: Member, action: MemberModerationAction, reason: string, timeoutMinutes?: number): Promise<boolean> => {
    if (!canModerateCommunityMember(access, community, member, action)) { setNotice({ error: true, text: "You cannot manage this member." }); return false; }
    const result = await memberManagementService.moderateMember({ communityId: community.id, actorId: access.userId, targetUserId: member.userId, targetDisplayName: member.displayName, action, reason, timeoutMinutes });
    if (!result.ok) { setNotice({ error: true, text: result.message }); return false; }
    const members = action === "timeout" ? community.members.map((item) => item.userId === member.userId ? { ...item, status: "idle" as const, statusText: `Timed out until ${dateTimeService.formatCompactDateTime(result.data.timeoutUntil ?? new Date().toISOString())}` } : item) : community.members.filter((item) => item.userId !== member.userId);
    onMembersChanged(members); await refreshRestrictions(); setNotice({ error: false, text: `${member.displayName}: ${action} completed and audited.` }); return true;
  };

  const reverseRestriction = async () => {
    if (!pendingReverse || reverseReason.trim().length < 3 || busy) return;
    setBusy(true); const target = pendingReverse;
    const result = await memberManagementService.moderateMember({ communityId: community.id, actorId: access.userId, targetUserId: target.state.userId, targetDisplayName: target.state.displayName, action: target.action, reason: reverseReason });
    setBusy(false);
    if (!result.ok) { setNotice({ error: true, text: result.message }); return; }
    if (target.action === "untimeout") onMembersChanged(community.members.map((member) => member.userId === target.state.userId ? { ...member, status: "online", statusText: "Available" } : member));
    setPendingReverse(null); setReverseReason(""); await refreshRestrictions(); setNotice({ error: false, text: `${target.state.displayName}: ${target.action} completed and audited.` });
  };

  return <div className="community-moderation-center">
    {notice ? <p className={notice.error ? "moderation-center-notice error" : "moderation-center-notice"} role={notice.error ? "alert" : "status"}>{notice.text}</p> : null}
    {showMembers ? <section className="moderation-center-section"><header><div><span className="eyebrow">Role-aware actions</span><h3>Member moderation</h3></div><label><AppIcon name="search" size="sm" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search members" aria-label="Search members for moderation" /></label></header><div className="moderation-member-grid">{visibleMembers.map((member) => { const role = community.roles.find((item) => item.id === member.roleId); const allowed = canModerateCommunityMember(access, community, member, "timeout"); const timedOut = states.find((item) => item.recordType === "timeout" && item.userId === member.userId); return <article key={member.id}><MemberAvatar member={member} size={38} /><div><strong>{member.displayName}</strong><span>@{member.username} / {role?.name ?? "Member"}</span>{timedOut ? <small>Timed out until {dateTimeService.formatCompactDateTime(timedOut.expiresAt ?? "")}</small> : null}</div><div>{timedOut ? <button type="button" disabled={!allowed} onClick={() => setPendingReverse({ state: timedOut, action: "untimeout" })}>Remove timeout</button> : <button type="button" disabled={!allowed} onClick={() => setPendingMember({ member, action: "timeout" })}>Timeout</button>}<button type="button" disabled={!allowed} onClick={() => setPendingMember({ member, action: "kick" })}>Kick</button><button type="button" className="danger-action" disabled={!allowed} onClick={() => setPendingMember({ member, action: "ban" })}>Ban</button></div></article>; })}</div>{states.some((item) => item.recordType === "ban") ? <div className="moderation-restriction-list"><h4>Active bans</h4>{states.filter((item) => item.recordType === "ban").map((item) => <article key={`ban:${item.userId}`}><AppIcon name="lock" size="sm" /><div><strong>{item.displayName}</strong><span>{item.reason} / {dateTimeService.formatCompactDateTime(item.createdAt)}</span></div><button type="button" disabled={!canManageMembers} onClick={() => setPendingReverse({ state: item, action: "unban" })}>Unban</button></article>)}</div> : null}</section> : null}
    {showReports ? <section className="moderation-center-section"><header><div><span className="eyebrow">Controlled lifecycle</span><h3>{mode === "messages" ? "Reported content" : "Report queue"}</h3></div><label className="moderation-review-reason"><span>Review reason</span><input value={reviewReason} maxLength={500} onChange={(event) => setReviewReason(event.target.value)} placeholder="Required for status changes" /></label></header><div className="moderation-report-queue">{contentReports.length ? contentReports.map((report) => { const privateDirect = report.targetType === "direct_message" || Boolean(report.conversationId); return <article key={report.id}><div className="moderation-report-type"><AppIcon name={report.targetType.includes("podcast") ? "microphone" : report.targetType === "radio_session" ? "voice" : "inbox"} size="sm" /><span>{report.targetType.replace(/_/g, " ")}</span></div><div><strong>{report.reason.replace(/_/g, " ")}</strong><span>{report.description}</span>{report.evidenceExcerpt ? <small>Selected evidence: {report.evidenceExcerpt}</small> : null}<small>{dateTimeService.formatCompactDateTime(report.createdAt)} / {report.status.replace(/_/g, " ")}</small></div><div className="moderation-report-actions">{privateDirect ? <span className="restricted-source"><AppIcon name="lock" size="xs" />Picom Safety only</span> : <button type="button" onClick={() => onOpenSource(report)}>Open source</button>}<button type="button" disabled={busy || reviewReason.trim().length < 3 || !reportService.canTransitionReportStatus(report.status, "reviewed")} onClick={() => void updateReport(report, "reviewed")}>Reviewed</button><button type="button" disabled={busy || reviewReason.trim().length < 3 || !reportService.canTransitionReportStatus(report.status, "dismissed")} onClick={() => void updateReport(report, "dismissed")}>Dismiss</button><button type="button" disabled={busy || reviewReason.trim().length < 3 || !reportService.canTransitionReportStatus(report.status, "action_taken")} onClick={() => void updateReport(report, "action_taken")}>Action taken</button></div></article>; }) : <div className="community-admin-empty"><AppIcon name="inbox" size="lg" /><strong>No reports</strong><span>Only reports for this community and authorized target context appear here.</span></div>}</div></section> : null}
    {showLog ? <section className="moderation-center-section"><header><div><span className="eyebrow">Append-only evidence</span><h3>Moderation audit</h3></div></header>{access.permissions.includes("viewAuditLog") ? <div className="moderation-audit-list">{audit.length ? audit.map((entry) => <article key={entry.id}><AppIcon name="inbox" size="sm" /><div><strong>{entry.targetType}</strong><span>{entry.reason ?? entry.actionType}</span><small>{dateTimeService.formatCompactDateTime(entry.createdAt)} / actor {entry.actorId}</small></div></article>) : <p>No moderation audit entries yet.</p>}</div> : <div className="community-admin-note"><AppIcon name="lock" size="sm" /><span>Audit details require the separate viewAuditLog permission. Actions are still recorded.</span></div>}</section> : null}
    {pendingMember ? <MemberModerationModal member={pendingMember.member} action={pendingMember.action} onClose={() => setPendingMember(null)} onConfirm={(reason, minutes) => applyMemberAction(pendingMember.member, pendingMember.action, reason, minutes)} /> : null}
    {pendingReverse ? <div className="moderation-reverse-confirm" role="alertdialog" aria-modal="true"><AppIcon name="lock" size="lg" /><div><strong>{pendingReverse.action === "unban" ? "Remove this ban?" : "Remove this timeout?"}</strong><p>Provide a reason. The action is permission checked and audited.</p><textarea value={reverseReason} maxLength={500} rows={3} onChange={(event) => setReverseReason(event.target.value)} placeholder="Required reason" /></div><footer><button type="button" onClick={() => { setPendingReverse(null); setReverseReason(""); }}>Cancel</button><button type="button" disabled={busy || reverseReason.trim().length < 3} onClick={() => void reverseRestriction()}>Confirm {pendingReverse.action}</button></footer></div> : null}
  </div>;
}
