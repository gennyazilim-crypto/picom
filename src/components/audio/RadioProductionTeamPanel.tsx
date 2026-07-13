import { useEffect, useMemo, useState } from "react";
import { radioService } from "../../services/audio/radioService";
import { dateTimeService } from "../../services/dateTimeService";
import type { RadioAuditEntry, RadioSession, RadioSessionHostAssignment, RadioSessionHostRole } from "../../types/audio";
import type { Community, Member, Role } from "../../types/community";
import { AppIcon } from "../AppIcon";
import { MemberAvatar } from "../MemberAvatar";

type Props = Readonly<{ community: Community; currentUser: Member; session: RadioSession }>;
const assignmentOptions: readonly { id: RadioSessionHostRole; label: string; rank: number }[] = [
  { id: "producer", label: "Producer", rank: 70 },
  { id: "host", label: "Host", rank: 50 },
  { id: "co_host", label: "Co-host", rank: 40 },
];

function memberRole(community: Community, member?: Member): Role | undefined {
  return member ? community.roles.find((role) => role.id === member.roleId) : undefined;
}

function supportsAssignment(role: Role | undefined, assignment: RadioSessionHostRole): boolean {
  if (!role) return false;
  const capabilities = new Set(role.capabilities ?? []);
  if (role.level >= 80 || capabilities.has("manageCommunity")) return true;
  return assignment === "producer"
    ? capabilities.has("manageRadioHosts") || capabilities.has("manageRadioPrograms")
    : capabilities.has("hostRadio");
}

export function RadioProductionTeamPanel({ community, currentUser, session }: Props) {
  const actorRole = memberRole(community, currentUser);
  const actorIsOwner = community.ownerId === currentUser.userId;
  const actorLevel = actorIsOwner ? 100 : actorRole?.level ?? 0;
  const actorCapabilities = new Set(actorRole?.capabilities ?? []);
  const canAssignTeam = actorIsOwner
    || actorLevel >= 80
    || actorCapabilities.has("manageCommunity")
    || actorCapabilities.has("manageRadioCommunity")
    || actorCapabilities.has("manageRadioPrograms")
    || actorCapabilities.has("manageRadioHosts");
  const allowedOptions = useMemo(() => assignmentOptions.filter((option) => actorIsOwner || option.rank < actorLevel), [actorIsOwner, actorLevel]);
  const [hostRole, setHostRole] = useState<RadioSessionHostRole>(allowedOptions[0]?.id ?? "co_host");
  const [hostUserId, setHostUserId] = useState("");
  const [assignments, setAssignments] = useState<RadioSessionHostAssignment[]>([]);
  const [auditEntries, setAuditEntries] = useState<RadioAuditEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<RadioSessionHostAssignment | null>(null);

  const candidates = useMemo(() => community.members.filter((member) => {
    const role = memberRole(community, member);
    if (!supportsAssignment(role, hostRole)) return false;
    if (actorIsOwner) return true;
    return member.userId !== currentUser.userId && member.userId !== community.ownerId && (role?.level ?? 101) < actorLevel;
  }), [actorIsOwner, actorLevel, community, currentUser.userId, hostRole]);

  const visibleAssignments = useMemo(() => {
    if (assignments.some((assignment) => assignment.userId === session.hostUserId)) return assignments;
    return [{
      id: "primary-" + session.id,
      radioSessionId: session.id,
      userId: session.hostUserId,
      hostRole: "host" as const,
      assignedBy: session.hostUserId,
      assignedAt: session.startsAt,
    }, ...assignments];
  }, [assignments, session.hostUserId, session.id, session.startsAt]);

  const refresh = async () => {
    const [team, audit] = await Promise.all([radioService.getRadioSessionHosts(session.id), radioService.getRadioAuditHistory(session.id)]);
    if (team.ok) setAssignments(team.data);
    if (audit.ok) setAuditEntries(audit.data);
    if (!team.ok || !audit.ok) setNotice({ error: true, text: !team.ok ? team.error.message : !audit.ok ? audit.error.message : "Radio production data is unavailable." });
  };

  useEffect(() => {
    setHostUserId("");
    setPendingRemoval(null);
    setNotice(null);
    void refresh();
  }, [session.id]);

  useEffect(() => {
    if (!allowedOptions.some((option) => option.id === hostRole)) setHostRole(allowedOptions[0]?.id ?? "co_host");
  }, [allowedOptions, hostRole]);

  const assign = async () => {
    if (!hostUserId || !canAssignTeam) return;
    setBusy(true);
    setNotice(null);
    const result = await radioService.assignRadioHost({ sessionId: session.id, userId: hostUserId, hostRole });
    setBusy(false);
    if (!result.ok) {
      setNotice({ error: true, text: result.error.message });
      return;
    }
    setHostUserId("");
    setNotice({ error: false, text: "Production assignment saved and audited." });
    await refresh();
  };

  const remove = async () => {
    if (!pendingRemoval) return;
    setBusy(true);
    setNotice(null);
    const result = await radioService.removeRadioHost(session.id, pendingRemoval.userId);
    setBusy(false);
    setPendingRemoval(null);
    if (!result.ok) {
      setNotice({ error: true, text: result.error.message });
      return;
    }
    setNotice({ error: false, text: "Production assignment removed and audited." });
    await refresh();
  };

  const canRemove = (assignment: RadioSessionHostAssignment) => {
    if (!canAssignTeam || assignment.userId === session.hostUserId) return false;
    if (actorIsOwner) return true;
    const target = community.members.find((member) => member.userId === assignment.userId);
    const targetLevel = memberRole(community, target)?.level ?? 0;
    const assignmentRank = assignmentOptions.find((option) => option.id === assignment.hostRole)?.rank ?? 101;
    return assignment.userId !== currentUser.userId && targetLevel < actorLevel && assignmentRank < actorLevel;
  };

  return <>
    <section className="radio-production-team">
      <header>
        <div className="radio-production-side-header-copy">
          <p className="radio-production-eyebrow">Production team</p>
          <strong>Role-backed assignments</strong>
        </div>
        <span className="radio-production-side-icon" aria-hidden="true"><AppIcon name="users" size="md" /></span>
      </header>
      {notice ? <p className={notice.error ? "radio-inline-error" : "radio-inline-status"} role={notice.error ? "alert" : "status"}>{notice.text}</p> : null}
      {canAssignTeam ? <>
        <label><span>Common-role member</span><select value={hostUserId} disabled={busy} onChange={(event) => setHostUserId(event.target.value)}><option value="">Choose eligible member</option>{candidates.map((member) => <option key={member.userId} value={member.userId}>{member.displayName} · {memberRole(community, member)?.name}</option>)}</select></label>
        <label><span>Session assignment</span><select value={hostRole} disabled={busy || !allowedOptions.length} onChange={(event) => setHostRole(event.target.value as RadioSessionHostRole)}>{allowedOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <button type="button" className="radio-production-btn accent" disabled={!hostUserId || busy} onClick={() => void assign()}>Save assignment</button>
      </> : <p>Only Owner, Admin, or a common Radio Producer role can manage production assignments.</p>}
      <div className="radio-production-team-list">
        {visibleAssignments.map((assignment) => {
          const member = community.members.find((candidate) => candidate.userId === assignment.userId);
          const primary = assignment.userId === session.hostUserId;
          return <div key={assignment.id}>
            {member ? <MemberAvatar member={member} size={30} /> : <span className="radio-listener-fallback"><AppIcon name="users" size="sm" /></span>}
            <span><strong>{member?.displayName ?? "Assigned producer"}</strong><small>{primary ? "Primary host" : assignment.hostRole.replace("_", " ")}</small></span>
            <button type="button" className="danger" disabled={busy || !canRemove(assignment)} title={primary ? "Transfer the primary host before removal." : undefined} aria-label={"Remove " + (member?.displayName ?? "production member")} onClick={() => setPendingRemoval(assignment)}><AppIcon name="trash" size="sm" /></button>
          </div>;
        })}
      </div>
    </section>
    <section className="radio-audit-history">
      <header>
        <div className="radio-production-side-header-copy">
          <p className="radio-production-eyebrow">Session audit</p>
          <strong>Recent protected actions</strong>
        </div>
        <span className="radio-production-side-badge">{auditEntries.length}</span>
      </header>
      {auditEntries.length ? <div>{auditEntries.slice(0, 8).map((entry) => <article key={entry.id}><AppIcon name="inbox" size="sm" /><span><strong>{entry.reason ?? entry.targetType.replace(/_/g, " ")}</strong><small>{community.members.find((member) => member.userId === entry.actorUserId)?.displayName ?? "Authorized operator"} · {dateTimeService.formatNotificationTimestamp(entry.createdAt)}</small></span></article>)}</div> : <p>No session actions have been recorded in this local view yet.</p>}
    </section>
    {pendingRemoval ? <div className="radio-inline-confirmation" role="alertdialog" aria-modal="true"><strong>Remove this production assignment?</strong><p>The primary host cannot be removed here. This action is written to the audit log.</p><footer><button type="button" onClick={() => setPendingRemoval(null)}>Keep assignment</button><button type="button" className="danger" disabled={busy} onClick={() => void remove()}>Confirm removal</button></footer></div> : null}
  </>;
}
