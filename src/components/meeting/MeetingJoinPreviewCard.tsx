import type { MeetingJoinPreview } from "../../types/meetingScheduling";
import { AppIcon } from "../AppIcon";

const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Live / unscheduled";

export function MeetingJoinPreviewCard({ preview, message }: { preview: MeetingJoinPreview; message?: string }) {
  const capabilities = Object.entries(preview.capabilities ?? {}).filter(([, enabled]) => enabled).map(([key]) => key.replace(/^can/, "").replace(/([A-Z])/g, " $1").trim());
  return <section className="meeting-join-preview-card" aria-label="Meeting join preview">
    <header><span><AppIcon name={preview.mode === "voice" ? "voice" : "users"} size="md" /></span><div><small>{preview.communityName ?? "Picom community"}</small><strong>{preview.roomTitle ?? "Meeting"}</strong></div><b data-status={preview.status}>{preview.status ?? "available"}</b></header>
    <dl><div><dt>Host</dt><dd>{preview.hostName ?? "Meeting host"}</dd></div><div><dt>Starts</dt><dd>{formatDate(preview.scheduledFor)}</dd></div><div><dt>Access</dt><dd>{preview.joinPolicy?.replace(/_/g, " ") ?? "members"}</dd></div><div><dt>Waiting room</dt><dd>{preview.waitingRoomEnabled ? "Host admission" : "Direct entry"}</dd></div></dl>
    {capabilities.length ? <div className="meeting-info-capabilities">{capabilities.map((item) => <span key={item}>{item}</span>)}</div> : null}
    {message ? <p>{message}</p> : null}
  </section>;
}
