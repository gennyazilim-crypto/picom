import { useEffect, useMemo, useState } from "react";
import type { AuditActionType, AuditLogRecord } from "../types/auditLog";
import type { Community, Member } from "../types/community";
import { auditLogService } from "../services/auditLogService";
import { clipboardService } from "../services/clipboardService";
import { dateTimeService } from "../services/dateTimeService";
import { AppIcon } from "./AppIcon";

const actions: Array<{ value: "all" | AuditActionType; label: string }> = [
  { value: "all", label: "All actions" },
  { value: "community_update", label: "Community updates" },
  { value: "channel_create", label: "Channel created" },
  { value: "channel_update", label: "Channel updated" },
  { value: "channel_delete", label: "Channel deleted" },
  { value: "role_change", label: "Role changes" },
  { value: "member_change", label: "Member changes" },
  { value: "moderation_action", label: "Moderation actions" },
  { value: "invite_create", label: "Invite created" },
  { value: "invite_revoke", label: "Invite revoked" },
  { value: "invite_accept", label: "Invite accepted" },
];

const actionLabels = new Map(actions.filter((item) => item.value !== "all").map((item) => [item.value, item.label]));

export function CommunityAuditLogSection({ community, canView }: { community: Community; canView: boolean }) {
  const [records, setRecords] = useState<AuditLogRecord[]>([]);
  const [actor, setActor] = useState("");
  const [action, setAction] = useState<"all" | AuditActionType>("all");
  const [range, setRange] = useState("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const actorById = useMemo(() => {
    const result = new Map<string, Member>();
    community.members.forEach((member) => { result.set(member.userId, member); result.set(member.id, member); });
    return result;
  }, [community.members]);
  const channelById = useMemo(() => new Map(community.categories.flatMap((category) => category.channels.map((channel) => [channel.id, channel] as const))), [community.categories]);
  const roleById = useMemo(() => new Map(community.roles.map((role) => [role.id, role] as const)), [community.roles]);

  const getActorLabel = (actorId: string) => {
    const member = actorById.get(actorId);
    return member ? `${member.displayName} (@${member.username})` : `Former member (${actorId.slice(0, 8)})`;
  };

  const getTargetLabel = (record: AuditLogRecord) => {
    if (!record.targetId) return record.targetType;
    if (record.targetType === "channel") return channelById.has(record.targetId) ? `#${channelById.get(record.targetId)?.name}` : `Deleted channel (${record.targetId.slice(0, 8)})`;
    if (record.targetType === "member" || record.targetType === "user") return getActorLabel(record.targetId);
    if (record.targetType === "role") return roleById.get(record.targetId)?.name ?? `Deleted role (${record.targetId.slice(0, 8)})`;
    if (record.targetType === "community") return community.name;
    return `${record.targetType} / ${record.targetId.slice(0, 12)}`;
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotice(null);
    void auditLogService.list(community.id, canView).then((result) => {
      if (!active) return;
      if (result.ok) setRecords(result.data);
      else setNotice(result.message);
      setLoading(false);
    });
    return () => { active = false; };
  }, [canView, community.id]);

  const filtered = useMemo(() => {
    const cutoff = range === "7" ? Date.now() - 7 * 86_400_000 : range === "30" ? Date.now() - 30 * 86_400_000 : 0;
    const query = actor.trim().toLowerCase();
    return records.filter((record) => {
      const member = actorById.get(record.actorId);
      const actorSearch = `${record.actorId} ${member?.displayName ?? ""} ${member?.username ?? ""}`.toLowerCase();
      return (!query || actorSearch.includes(query)) && (action === "all" || record.actionType === action) && (!cutoff || Date.parse(record.createdAt) >= cutoff);
    });
  }, [action, actor, actorById, range, records]);

  const copy = async () => {
    const exported = auditLogService.exportForAdmin(filtered, canView);
    if (!exported.ok) { setNotice(exported.message); return; }
    const result = await clipboardService.copyText(exported.data);
    setNotice(result.ok ? "Filtered audit JSON copied." : result.reason);
  };

  const download = () => {
    const exported = auditLogService.exportForAdmin(filtered, canView);
    if (!exported.ok) { setNotice(exported.message); return; }
    const blob = new Blob([exported.data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `picom-audit-${community.id.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Filtered audit JSON exported.");
  };

  if (!canView) return <section className="community-admin-section audit-log-section"><div className="community-admin-empty"><AppIcon name="lock" size="lg" /><strong>Audit log unavailable</strong><span>Owner or admin permission is required.</span></div></section>;

  const exportDisabled = filtered.length === 0;
  return <section className="community-admin-section audit-log-section">
    <header><p className="eyebrow">Append-only history</p><h3>Audit log</h3><span>Administrative events only. Tokens, passwords, and message content are excluded.</span></header>
    <div className="audit-log-toolbar">
      <label><span>Actor</span><input value={actor} onChange={(event) => setActor(event.target.value)} placeholder="Name, username, or ID" /></label>
      <label><span>Action</span><select value={action} onChange={(event) => setAction(event.target.value as typeof action)}>{actions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label><span>Date range</span><select value={range} onChange={(event) => setRange(event.target.value)}><option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label>
      <div className="audit-export-actions"><button type="button" disabled={exportDisabled} onClick={() => void copy()}><AppIcon name="paperclip" size="sm" />Copy JSON</button><button type="button" disabled={exportDisabled} onClick={download}><AppIcon name="send" size="sm" />Export JSON</button></div>
    </div>
    {notice ? <p className="audit-log-notice" role="status">{notice}</p> : null}
    <div className="audit-log-summary" aria-label="Audit result summary"><strong>{filtered.length}</strong><span>matching append-only events</span><em>{records.length} loaded</em></div>
    {loading ? <div className="community-admin-empty"><AppIcon name="inbox" size="lg" /><strong>Loading audit history</strong><span>Retrieving permitted administrative events.</span></div> : filtered.length ? <div className="audit-log-list">{filtered.map((record) => <article key={record.id}>
      <div><strong>{actionLabels.get(record.actionType) ?? record.actionType.replace(/_/g, " ")}</strong><span title={dateTimeService.formatFullTimestamp(record.createdAt)}>{dateTimeService.formatFullTimestamp(record.createdAt)}</span></div>
      <dl><div><dt>Actor</dt><dd title={record.actorId}>{getActorLabel(record.actorId)}</dd></div><div><dt>Target</dt><dd title={record.targetId ?? record.targetType}>{getTargetLabel(record)}</dd></div><div><dt>Reason</dt><dd title={record.reason ?? "No reason provided"}>{record.reason ?? "No reason provided"}</dd></div></dl>
    </article>)}</div> : <div className="community-admin-empty"><AppIcon name="inbox" size="lg" /><strong>No matching audit events</strong><span>Adjust filters or perform an audited administrative action.</span></div>}
  </section>;
}
