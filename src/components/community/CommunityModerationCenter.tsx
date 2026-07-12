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
type Props = Readonly<{
  community: Community;
  access: CommunityAccess;
  mode: CommunityModerationMode;
  onMembersChanged: (members: Member[]) => void;
  onOpenSource: (report: ReportRecord) => void;
}>;
type PendingReverse = Readonly<{ state: CommunityModerationState; action: "unban" | "untimeout" }>;

function reportIcon(targetType: ReportRecord["targetType"]): "microphone" | "voice" | "inbox" {
  if (targetType.includes("podcast")) return "microphone";
  if (targetType === "radio_session") return "voice";
  return "inbox";
}

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
    if (result.ok) setStates(result.data);
    else if (showMembers) setNotice({ error: true, text: result.message });
  };

  useEffect(() => {
    let active = true;
    setNotice(null);
    if (showReports) {
      void reportService.listCommunityReports(community.id, canReview).then((result) => {
        if (!active) return;
        if (result.ok) setReports(result.data);
        else setNotice({ error: true, text: result.message });
      });
    }
    if (showMembers) {
      void memberManagementService.listModerationStates(community.id, canManageMembers).then((result) => {
        if (!active) return;
        if (result.ok) setStates(result.data);
        else setNotice({ error: true, text: result.message });
      });
    }
    if (showLog) {
      void auditLogService.list(community.id, access.permissions.includes("viewAuditLog")).then((result) => {
        if (!active) return;
        if (result.ok) {
          setAudit(result.data.filter((item) => item.actionType === "moderation_action").slice(0, 50));
        }
      });
    }
    return () => {
      active = false;
    };
  }, [access.permissions, canManageMembers, canReview, community.id, showLog, showMembers, showReports]);

  const visibleMembers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return community.members.filter(
      (member) =>
        !needle ||
        member.displayName.toLowerCase().includes(needle) ||
        member.username.toLowerCase().includes(needle),
    );
  }, [community.members, query]);

  const contentReports = useMemo(
    () =>
      reports.filter(
        (report) =>
          mode !== "messages" ||
          ["message", "radio_session", "podcast_episode", "podcast_comment"].includes(report.targetType),
      ),
    [mode, reports],
  );

  const memberCounts = useMemo(() => {
    const timeouts = states.filter((item) => item.recordType === "timeout").length;
    const bans = states.filter((item) => item.recordType === "ban").length;
    return { members: community.members.length, timeouts, bans };
  }, [community.members.length, states]);

  const reportSummary = useMemo(
    () =>
      contentReports.reduce(
        (summary, report) => {
          summary[report.status] += 1;
          return summary;
        },
        { open: 0, reviewed: 0, dismissed: 0, action_taken: 0 },
      ),
    [contentReports],
  );

  const updateReport = async (report: ReportRecord, status: ReportStatus) => {
    if (busy || reviewReason.trim().length < 3 || !reportService.canTransitionReportStatus(report.status, status)) return;
    setBusy(true);
    setNotice(null);
    const result = await reportService.updateReportStatus({
      reportId: report.id,
      status,
      canReview,
      reviewedById: access.userId,
      reviewReason,
    });
    setBusy(false);
    if (!result.ok) {
      setNotice({ error: true, text: result.message });
      return;
    }
    setReports((current) => current.map((item) => (item.id === report.id ? result.data : item)));
    setReviewReason("");
    setNotice({ error: false, text: `Report moved to ${status.replace("_", " ")}.` });
  };

  const applyMemberAction = async (
    member: Member,
    action: MemberModerationAction,
    reason: string,
    timeoutMinutes?: number,
  ): Promise<boolean> => {
    if (!canModerateCommunityMember(access, community, member, action)) {
      setNotice({ error: true, text: "You cannot manage this member." });
      return false;
    }
    const result = await memberManagementService.moderateMember({
      communityId: community.id,
      actorId: access.userId,
      targetUserId: member.userId,
      targetDisplayName: member.displayName,
      action,
      reason,
      timeoutMinutes,
    });
    if (!result.ok) {
      setNotice({ error: true, text: result.message });
      return false;
    }
    const members =
      action === "timeout"
        ? community.members.map((item) =>
            item.userId === member.userId
              ? {
                  ...item,
                  status: "idle" as const,
                  statusText: `Timed out until ${dateTimeService.formatCompactDateTime(result.data.timeoutUntil ?? new Date().toISOString())}`,
                }
              : item,
          )
        : community.members.filter((item) => item.userId !== member.userId);
    onMembersChanged(members);
    await refreshRestrictions();
    setNotice({ error: false, text: `${member.displayName}: ${action} completed and audited.` });
    return true;
  };

  const reverseRestriction = async () => {
    if (!pendingReverse || reverseReason.trim().length < 3 || busy) return;
    setBusy(true);
    const target = pendingReverse;
    const result = await memberManagementService.moderateMember({
      communityId: community.id,
      actorId: access.userId,
      targetUserId: target.state.userId,
      targetDisplayName: target.state.displayName,
      action: target.action,
      reason: reverseReason,
    });
    setBusy(false);
    if (!result.ok) {
      setNotice({ error: true, text: result.message });
      return;
    }
    if (target.action === "untimeout") {
      onMembersChanged(
        community.members.map((member) =>
          member.userId === target.state.userId ? { ...member, status: "online", statusText: "Available" } : member,
        ),
      );
    }
    setPendingReverse(null);
    setReverseReason("");
    await refreshRestrictions();
    setNotice({ error: false, text: `${target.state.displayName}: ${target.action} completed and audited.` });
  };

  const activeBans = states.filter((item) => item.recordType === "ban");

  return (
    <div className="community-moderation-center">
      {notice ? (
        <p
          className={notice.error ? "community-mgmt-notice is-error" : "community-mgmt-notice"}
          role={notice.error ? "alert" : "status"}
        >
          {notice.text}
        </p>
      ) : null}

      {showMembers ? (
        <section className="moderation-center-section moderation-members-section">
          <div className="community-mgmt-card moderation-members-toolbar">
            <div className="moderation-members-toolbar-copy">
              <p className="community-mgmt-subcard-title">Member moderation</p>
              <span>Role-aware actions remain permission checked and require confirmation.</span>
            </div>
            <label className="moderation-member-search">
              <AppIcon name="search" size="sm" />
              <input
                className="community-mgmt-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search members"
                aria-label="Search members for moderation"
              />
            </label>
          </div>

          <div className="moderation-member-metrics" aria-label="Member restriction summary">
            <article className="moderation-member-metric">
              <span className="moderation-member-metric-icon" aria-hidden="true">
                <AppIcon name="users" size="sm" />
              </span>
              <strong>{memberCounts.members}</strong>
              <span>Members</span>
            </article>
            <article className="moderation-member-metric moderation-member-metric--timeout">
              <span className="moderation-member-metric-icon" aria-hidden="true">
                <AppIcon name="bell" size="sm" />
              </span>
              <strong>{memberCounts.timeouts}</strong>
              <span>Timeouts</span>
            </article>
            <article className="moderation-member-metric moderation-member-metric--ban">
              <span className="moderation-member-metric-icon" aria-hidden="true">
                <AppIcon name="lock" size="sm" />
              </span>
              <strong>{memberCounts.bans}</strong>
              <span>Active bans</span>
            </article>
          </div>

          <div className="moderation-member-grid">
            {visibleMembers.map((member) => {
              const role = community.roles.find((item) => item.id === member.roleId);
              const allowed = canModerateCommunityMember(access, community, member, "timeout");
              const timedOut = states.find((item) => item.recordType === "timeout" && item.userId === member.userId);

              return (
                <article key={member.id} className="moderation-member-card">
                  <MemberAvatar member={member} size={40} />
                  <div className="moderation-member-copy">
                    <div className="moderation-member-title-row">
                      <strong>{member.displayName}</strong>
                      <span className="community-mgmt-badge moderation-role-badge">{role?.name ?? "Member"}</span>
                    </div>
                    <span>@{member.username}</span>
                    {timedOut ? (
                      <small>Timed out until {dateTimeService.formatCompactDateTime(timedOut.expiresAt ?? "")}</small>
                    ) : null}
                  </div>
                  <div className="moderation-member-actions">
                    {timedOut ? (
                      <button
                        type="button"
                        className="community-mgmt-action community-mgmt-action--ghost"
                        disabled={!allowed}
                        onClick={() => setPendingReverse({ state: timedOut, action: "untimeout" })}
                      >
                        Remove timeout
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="community-mgmt-action community-mgmt-action--ghost"
                        disabled={!allowed}
                        onClick={() => setPendingMember({ member, action: "timeout" })}
                      >
                        Timeout
                      </button>
                    )}
                    <button
                      type="button"
                      className="community-mgmt-action community-mgmt-action--ghost"
                      disabled={!allowed}
                      onClick={() => setPendingMember({ member, action: "kick" })}
                    >
                      Kick
                    </button>
                    <button
                      type="button"
                      className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--danger"
                      disabled={!allowed}
                      onClick={() => setPendingMember({ member, action: "ban" })}
                    >
                      Ban
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {activeBans.length ? (
            <div className="community-mgmt-subcard moderation-restriction-list">
              <h4 className="community-mgmt-subcard-title">Active bans</h4>
              <div className="moderation-ban-grid">
                {activeBans.map((item) => (
                  <article key={`ban:${item.userId}`} className="moderation-ban-card">
                    <span className="moderation-ban-icon" aria-hidden="true">
                      <AppIcon name="lock" size="sm" />
                    </span>
                    <div className="moderation-ban-copy">
                      <strong>{item.displayName}</strong>
                      <span>
                        {item.reason} · {dateTimeService.formatCompactDateTime(item.createdAt)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="community-mgmt-action community-mgmt-action--ghost"
                      disabled={!canManageMembers}
                      onClick={() => setPendingReverse({ state: item, action: "unban" })}
                    >
                      Unban
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {showReports ? (
        <section className="moderation-center-section moderation-reports-section">
          <div className="community-mgmt-card moderation-reports-toolbar">
            <div>
              <p className="community-mgmt-subcard-title">{mode === "messages" ? "Reported content" : "Report queue"}</p>
              <span>Controlled lifecycle transitions require a review reason.</span>
            </div>
            <label className="community-mgmt-field moderation-review-reason">
              <span>Review reason</span>
              <input
                className="community-mgmt-input"
                value={reviewReason}
                maxLength={500}
                onChange={(event) => setReviewReason(event.target.value)}
                placeholder="Required for status changes"
              />
            </label>
          </div>

          <div className="moderation-report-metrics" aria-label="Report queue summary">
            <article className="moderation-report-metric">
              <strong>{reportSummary.open}</strong>
              <span>Open</span>
            </article>
            <article className="moderation-report-metric">
              <strong>{reportSummary.reviewed}</strong>
              <span>Reviewed</span>
            </article>
            <article className="moderation-report-metric">
              <strong>{reportSummary.action_taken}</strong>
              <span>Action taken</span>
            </article>
          </div>

          <div className="moderation-report-queue">
            {contentReports.length ? (
              contentReports.map((report) => {
                const privateDirect = report.targetType === "direct_message" || Boolean(report.conversationId);
                return (
                  <article key={report.id} className="moderation-report-card">
                    <div className="moderation-report-type">
                      <AppIcon name={reportIcon(report.targetType)} size="sm" />
                      <span>{report.targetType.replace(/_/g, " ")}</span>
                    </div>
                    <div className="moderation-report-copy">
                      <div className="moderation-report-title-row">
                        <strong>{report.reason.replace(/_/g, " ")}</strong>
                        <span className="community-mgmt-badge moderation-report-status-badge">{report.status.replace(/_/g, " ")}</span>
                      </div>
                      <span>{report.description}</span>
                      {report.evidenceExcerpt ? <small>Selected evidence: {report.evidenceExcerpt}</small> : null}
                      <small>{dateTimeService.formatCompactDateTime(report.createdAt)}</small>
                    </div>
                    <div className="moderation-report-actions">
                      {privateDirect ? (
                        <span className="moderation-restricted-badge">
                          <AppIcon name="lock" size="xs" />
                          Picom Safety only
                        </span>
                      ) : (
                        <button type="button" className="community-mgmt-action community-mgmt-action--ghost" onClick={() => onOpenSource(report)}>
                          Open source
                        </button>
                      )}
                      <button
                        type="button"
                        className="community-mgmt-action community-mgmt-action--ghost"
                        disabled={busy || reviewReason.trim().length < 3 || !reportService.canTransitionReportStatus(report.status, "reviewed")}
                        onClick={() => void updateReport(report, "reviewed")}
                      >
                        Reviewed
                      </button>
                      <button
                        type="button"
                        className="community-mgmt-action community-mgmt-action--ghost"
                        disabled={busy || reviewReason.trim().length < 3 || !reportService.canTransitionReportStatus(report.status, "dismissed")}
                        onClick={() => void updateReport(report, "dismissed")}
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--danger"
                        disabled={busy || reviewReason.trim().length < 3 || !reportService.canTransitionReportStatus(report.status, "action_taken")}
                        onClick={() => void updateReport(report, "action_taken")}
                      >
                        Action taken
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="community-mgmt-empty">
                <strong>No reports</strong>
                <span>Only reports for this community and authorized target context appear here.</span>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {showLog ? (
        <section className="moderation-center-section moderation-log-section">
          <div className="community-mgmt-card moderation-log-header">
            <div>
              <p className="community-mgmt-subcard-title">Moderation audit</p>
              <span>Append-only evidence for permitted reviewers.</span>
            </div>
          </div>
          {access.permissions.includes("viewAuditLog") ? (
            <div className="moderation-audit-list">
              {audit.length ? (
                audit.map((entry) => (
                  <article key={entry.id} className="moderation-audit-card">
                    <span className="moderation-audit-icon" aria-hidden="true">
                      <AppIcon name="inbox" size="sm" />
                    </span>
                    <div className="moderation-audit-copy">
                      <strong>{entry.targetType}</strong>
                      <span>{entry.reason ?? entry.actionType}</span>
                      <small>
                        {dateTimeService.formatCompactDateTime(entry.createdAt)} · actor {entry.actorId}
                      </small>
                    </div>
                  </article>
                ))
              ) : (
                <div className="community-mgmt-empty">
                  <strong>No moderation audit entries yet</strong>
                  <span>Actions are recorded even when this list is empty.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="community-mgmt-notice moderation-audit-notice">
              <span aria-hidden="true"><AppIcon name="lock" size="sm" /></span>
              Audit details require the separate viewAuditLog permission. Actions are still recorded.
            </div>
          )}
        </section>
      ) : null}

      {pendingMember ? (
        <MemberModerationModal
          member={pendingMember.member}
          action={pendingMember.action}
          onClose={() => setPendingMember(null)}
          onConfirm={(reason, minutes) => applyMemberAction(pendingMember.member, pendingMember.action, reason, minutes)}
        />
      ) : null}

      {pendingReverse ? (
        <div className="moderation-reverse-confirm" role="alertdialog" aria-modal="true" aria-labelledby="moderation-reverse-title">
          <span className="moderation-reverse-icon" aria-hidden="true">
            <AppIcon name="lock" size="lg" />
          </span>
          <div className="moderation-reverse-copy">
            <strong id="moderation-reverse-title">
              {pendingReverse.action === "unban" ? "Remove this ban?" : "Remove this timeout?"}
            </strong>
            <p>Provide a reason. The action is permission checked and audited.</p>
            <textarea
              className="community-mgmt-textarea"
              value={reverseReason}
              maxLength={500}
              rows={3}
              onChange={(event) => setReverseReason(event.target.value)}
              placeholder="Required reason"
            />
          </div>
          <footer className="community-mgmt-footer">
            <button
              type="button"
              className="community-mgmt-action community-mgmt-action--ghost"
              onClick={() => {
                setPendingReverse(null);
                setReverseReason("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="community-mgmt-action"
              disabled={busy || reverseReason.trim().length < 3}
              onClick={() => void reverseRestriction()}
            >
              Confirm {pendingReverse.action}
            </button>
          </footer>
        </div>
      ) : null}
    </div>
  );
}
