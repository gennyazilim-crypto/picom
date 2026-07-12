import { useEffect, useMemo, useState } from "react";
import type { MeetingClientParticipant, MeetingClientSnapshot } from "../../types/meetingClient";
import type { MeetingStageServiceResult } from "../../services/meeting/meetingStageService";
import { meetingService } from "../../services/meeting/meetingService";
import { meetingStageService } from "../../services/meeting/meetingStageService";
import { AppIcon } from "../AppIcon";
import { MeetingParticipantTile } from "./MeetingParticipantTile";
import "./MeetingStageAudience.css";

const STAGE_ROLES = new Set(["host", "cohost", "speaker"]);
const isStageParticipant = (participant: MeetingClientParticipant): boolean => STAGE_ROLES.has(participant.role);
const initials = (name: string): string => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "P";

export function MeetingStageAudience({ snapshot, onFocusParticipant, onOpenPeople }: { snapshot: MeetingClientSnapshot; onFocusParticipant: (id: string | null) => void; onOpenPeople: () => void }) {
  const [tab, setTab] = useState<"participants" | "viewers">("participants");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const participants = useMemo(() => snapshot.participantIds.map((id) => snapshot.participantsById[id]).filter(Boolean), [snapshot.participantIds, snapshot.participantsById]);
  const stage = participants.filter(isStageParticipant);
  const viewers = participants.filter((participant) => !isStageParticipant(participant));
  const local = participants.find((participant) => participant.isLocal);
  const pending = (snapshot.stageQueue ?? []).filter((entry) => entry.stageRequestStatus === "requested");
  const localRequest = local ? snapshot.stageQueue?.find((entry) => entry.participantId === local.id) : undefined;
  const manager = snapshot.capabilities.canManageParticipants;
  const visible = tab === "participants" ? participants : viewers;
  const subscriptionKey = stage.map((participant) => `${participant.identity}:${participant.isSpeaking}`).join("|");

  useEffect(() => {
    meetingService.setVideoSubscriptions({ visibleParticipantIdentities: stage.filter((participant) => participant.cameraEnabled).map((participant) => participant.identity), activeSpeakerIdentities: stage.filter((participant) => participant.isSpeaking && participant.cameraEnabled).map((participant) => participant.identity), focusedParticipantIdentity: null, visibleTileCount: stage.length, qualityPreset: "balanced", tileSizeByIdentity: Object.fromEntries(stage.filter((participant) => participant.cameraEnabled).map((participant) => [participant.identity, participant.isSpeaking ? "focus" as const : stage.length <= 4 ? "standard" as const : "thumbnail" as const])), stageOnly: true });
  }, [subscriptionKey]);
  useEffect(() => () => { meetingService.setVideoSubscriptions({ visibleParticipantIdentities: [], activeSpeakerIdentities: [], focusedParticipantIdentity: null, visibleTileCount: 0 }); }, []);

  const run = async (key: string, operation: () => Promise<MeetingStageServiceResult<unknown>>) => {
    setBusy(key); setError("");
    const result = await operation();
    if (!result.ok) setError(result.error.message);
    setBusy(null);
  };

  return (
    <section className="meeting-stage-audience" aria-label="Stage and audience workspace">
      <header className="meeting-stage-audience__header">
        <span><small>{snapshot.context?.communityName ?? "Picom community"}</small><strong>{snapshot.context?.roomTitle ?? "Stage room"}</strong></span>
        <span className="meeting-stage-audience__live"><i aria-hidden="true" />Live stage</span>
        <button type="button" onClick={onOpenPeople}><AppIcon name="users" size="sm" />People</button>
      </header>
      <div className="meeting-stage-audience__body">
        <div className="meeting-stage-audience__stage">
          {stage.length ? <div className="meeting-stage-audience__grid">{stage.map((participant) => <MeetingParticipantTile participant={participant} variant="stage" focused={participant.id === snapshot.focusedParticipantId} key={participant.id} onActivate={() => onFocusParticipant(participant.id === snapshot.focusedParticipantId ? null : participant.id)} />)}</div> : <div className="meeting-stage-audience__empty"><AppIcon name="users" size="xl" /><strong>The stage is ready</strong><p>Approved speakers will appear here.</p></div>}
          {local && !isStageParticipant(local) ? <div className="meeting-stage-audience__request"><span><strong>Join the conversation</strong><small>Viewers listen by default and publish only after a host promotes them.</small></span>{localRequest?.stageRequestStatus === "requested" ? <button type="button" disabled={busy === local.id} onClick={() => run(local.id, () => meetingStageService.cancelRequest(local.id))}>Cancel request</button> : <button type="button" disabled={busy === local.id || !snapshot.capabilities.canRaiseHand} onClick={() => run(local.id, () => meetingStageService.requestToSpeak(local.id))}>Request to speak</button>}</div> : null}
          {error ? <p className="meeting-stage-audience__error" role="alert">{error}</p> : null}
        </div>
        <aside className="meeting-stage-audience__audience" aria-label="Stage participants and viewers">
          <div className="meeting-stage-audience__tabs" role="tablist" aria-label="Audience lists"><button type="button" role="tab" aria-selected={tab === "participants"} onClick={() => setTab("participants")}>Participants <span>{participants.length}</span></button><button type="button" role="tab" aria-selected={tab === "viewers"} onClick={() => setTab("viewers")}>Viewers <span>{viewers.length}</span></button></div>
          {manager && pending.length ? <section className="meeting-stage-audience__queue"><h3>Requests to speak <span>{pending.length}</span></h3>{pending.map((entry) => <article key={entry.participantId}><span className="meeting-stage-audience__small-avatar" aria-hidden="true">{initials(entry.displayName)}</span><span><strong>{entry.displayName}</strong><small>Waiting for stage approval</small></span><div><button type="button" disabled={busy === entry.participantId} onClick={() => run(entry.participantId, () => meetingStageService.approveRequest(entry.participantId))}>Approve</button><button type="button" disabled={busy === entry.participantId} onClick={() => run(entry.participantId, () => meetingStageService.denyRequest(entry.participantId))}>Deny</button></div></article>)}</section> : null}
          <div className="meeting-stage-audience__list" role="tabpanel">{visible.map((participant) => <article key={participant.id}><span className="meeting-stage-audience__small-avatar" aria-hidden="true">{initials(participant.displayName)}</span><span><strong>{participant.displayName}{participant.isLocal ? " (you)" : ""}</strong><small>{participant.role} - {participant.presence}</small></span>{manager && !participant.isLocal ? <div>{isStageParticipant(participant) && participant.role !== "host" ? <button type="button" disabled={busy === participant.id} onClick={() => run(participant.id, () => meetingStageService.demoteParticipant(participant.id))}>Move to audience</button> : !isStageParticipant(participant) ? <button type="button" disabled={busy === participant.id} onClick={() => run(participant.id, () => meetingStageService.promoteParticipant(participant.id))}>Invite to stage</button> : null}</div> : null}</article>)}</div>
        </aside>
      </div>
    </section>
  );
}
