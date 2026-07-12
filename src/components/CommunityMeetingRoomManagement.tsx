import { useEffect, useMemo, useState } from "react";
import type { Community } from "../types/community";
import type { CommunityAccess } from "../types/communityAccess";
import type { CommunityMeetingRoom, CommunityMeetingRoomDraft, MeetingRoomArchivePolicy } from "../types/meetingAdmin";
import { meetingRoomAdminService } from "../services/meeting/meetingRoomAdminService";
import { AppIcon } from "./AppIcon";
import "./CommunityMeetingRoomManagement.css";

type Props = Readonly<{ community: Community; access: CommunityAccess; onOpenRoom?: (room: CommunityMeetingRoom) => void }>;

const initialDraft = (community: Community): CommunityMeetingRoomDraft => ({
  title: "",
  description: "",
  mode: "voice",
  categoryId: community.categories[0]?.id ?? null,
  linkedChatChannelId: community.categories.flatMap((item) => item.channels).find((item) => item.type === "text")?.id ?? null,
  joinPolicy: "members",
  capabilities: { canPublishAudio: true, canPublishVideo: false, canShareScreen: false, canSendChat: true, canReact: true, canRaiseHand: true },
  waitingRoomEnabled: false,
  audienceMode: false,
  maxParticipants: 50,
  moderationPolicy: { allowParticipantMute: false, allowParticipantRemove: false, raiseHandRequired: false },
});

const draftFromRoom = (room: CommunityMeetingRoom, categoryId: string | null): CommunityMeetingRoomDraft => ({
  title: room.title,
  description: room.description,
  mode: room.mode,
  categoryId,
  linkedChatChannelId: room.linkedChatChannelId,
  joinPolicy: room.joinPolicy,
  capabilities: room.capabilities,
  waitingRoomEnabled: room.waitingRoomEnabled,
  audienceMode: room.audienceMode,
  maxParticipants: room.maxParticipants,
  moderationPolicy: room.moderationPolicy,
});

const capabilityOptions = [
  ["canPublishAudio", "Microphone"],
  ["canPublishVideo", "Camera"],
  ["canShareScreen", "Screen share"],
  ["canSendChat", "Linked chat"],
  ["canReact", "Reactions"],
  ["canRaiseHand", "Raise hand"],
] as const;

const moderationOptions = [
  ["allowParticipantMute", "Participant mute"],
  ["allowParticipantRemove", "Participant remove"],
  ["raiseHandRequired", "Raise hand required"],
] as const;

function modeLabel(mode: CommunityMeetingRoom["mode"]): string {
  if (mode === "voice") return "Voice Lounge";
  if (mode === "stage") return "Stage and audience";
  return "Camera meeting";
}

export function CommunityMeetingRoomManagement({ community, access, onOpenRoom }: Props) {
  const [rooms, setRooms] = useState<CommunityMeetingRoom[]>([]);
  const [draft, setDraft] = useState<CommunityMeetingRoomDraft>(() => initialDraft(community));
  const [editing, setEditing] = useState<CommunityMeetingRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [archiveRoom, setArchiveRoom] = useState<CommunityMeetingRoom | null>(null);
  const [archiveTitle, setArchiveTitle] = useState("");
  const [archivePolicy, setArchivePolicy] = useState<MeetingRoomArchivePolicy>("deny");
  const [replacementId, setReplacementId] = useState<string | null>(null);

  const channels = useMemo(() => community.categories.flatMap((item) => item.channels), [community.categories]);
  const chatChannels = channels.filter((item) => item.type === "text" || item.type === "announcement");
  const canCreate = access.isOwner || access.permissions.includes("createMeeting");
  const canManage = access.isOwner || access.permissions.includes("manageMeeting");
  const locked = Boolean(editing?.activeSessionCount);

  const reload = async () => {
    const result = await meetingRoomAdminService.list(community.id);
    if (result.ok) setRooms(result.data);
    else setNotice({ error: true, text: result.error });
  };

  useEffect(() => {
    setDraft(initialDraft(community));
    setEditing(null);
    void reload();
  }, [community.id]);

  const patchDraft = <K extends keyof CommunityMeetingRoomDraft>(key: K, value: CommunityMeetingRoomDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    if (!canCreate && !editing) return;
    setBusy(true);
    setNotice(null);
    const result = editing ? await meetingRoomAdminService.update(editing, draft) : await meetingRoomAdminService.create(community.id, draft);
    setBusy(false);
    if (!result.ok) {
      setNotice({ error: true, text: result.error });
      return;
    }
    setNotice({ error: false, text: editing ? "Meeting room updated." : `${result.data.title} created for ${result.data.workspace.replace("_", " ")}.` });
    setEditing(null);
    setDraft(initialDraft(community));
    await reload();
  };

  const move = async (room: CommunityMeetingRoom, direction: "up" | "down") => {
    setBusy(true);
    const result = await meetingRoomAdminService.move(room, direction);
    setBusy(false);
    if (!result.ok) setNotice({ error: true, text: result.error });
    else await reload();
  };

  const archive = async () => {
    if (!archiveRoom) return;
    setBusy(true);
    const result = await meetingRoomAdminService.archive(archiveRoom, archiveTitle, archivePolicy, replacementId);
    setBusy(false);
    if (!result.ok) {
      setNotice({ error: true, text: result.error });
      return;
    }
    setArchiveRoom(null);
    setArchiveTitle("");
    setArchivePolicy("deny");
    setReplacementId(null);
    setNotice({ error: false, text: "Meeting room archived with audit history retained." });
    await reload();
  };

  const resetEditor = () => {
    setEditing(null);
    setDraft(initialDraft(community));
  };

  return (
    <section className="meeting-room-admin community-mgmt-card" aria-label="Community meeting rooms">
      <header className="community-mgmt-card-header">
        <div className="community-mgmt-card-header-copy">
          <p className="eyebrow">Voice and meetings</p>
          <h3>Meeting rooms</h3>
          <p>Configure Voice Lounge, camera meetings, and stage/audience rooms without leaving Community Admin.</p>
        </div>
        <span className="community-mgmt-card-icon" aria-hidden="true">
          <AppIcon name="users" size="md" />
        </span>
      </header>

      {notice ? <p className={`community-mgmt-notice${notice.error ? " is-error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.text}</p> : null}

      {canCreate || editing ? (
        <div className="meeting-room-editor community-mgmt-subcard">
          <h4 className="community-mgmt-subcard-title">{editing ? `Edit ${editing.title}` : "Create a room"}</h4>
          <div className="meeting-room-editor-grid">
            <label className="community-mgmt-field">
              <span>Room name</span>
              <input className="community-mgmt-input" value={draft.title} maxLength={120} onChange={(event) => patchDraft("title", event.target.value)} />
            </label>
            <label className="community-mgmt-field">
              <span>Experience</span>
              <select className="community-mgmt-select" value={draft.mode} disabled={locked} onChange={(event) => {
                const mode = event.target.value as CommunityMeetingRoomDraft["mode"];
                setDraft((current) => ({
                  ...current,
                  mode,
                  audienceMode: mode === "stage",
                  waitingRoomEnabled: mode === "stage" || current.waitingRoomEnabled,
                  capabilities: { ...current.capabilities, canPublishVideo: mode !== "voice", canShareScreen: mode !== "voice" },
                  moderationPolicy: { ...current.moderationPolicy, raiseHandRequired: mode === "stage" },
                }));
              }}>
                <option value="voice">Voice Lounge</option>
                <option value="meeting">Meeting</option>
                <option value="stage">Stage and audience</option>
              </select>
            </label>
            <label className="community-mgmt-field">
              <span>Voice category</span>
              <select className="community-mgmt-select" value={draft.categoryId ?? ""} onChange={(event) => patchDraft("categoryId", event.target.value || null)}>
                {community.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="community-mgmt-field">
              <span>Linked chat</span>
              <select className="community-mgmt-select" value={draft.linkedChatChannelId ?? ""} onChange={(event) => patchDraft("linkedChatChannelId", event.target.value || null)}>
                <option value="">No linked chat</option>
                {chatChannels.map((item) => <option key={item.id} value={item.id}>#{item.name}</option>)}
              </select>
            </label>
            <label className="community-mgmt-field">
              <span>Guest policy</span>
              <select className="community-mgmt-select" value={draft.joinPolicy} disabled={locked} onChange={(event) => patchDraft("joinPolicy", event.target.value as CommunityMeetingRoomDraft["joinPolicy"])}>
                <option value="members">Members</option>
                <option value="open">Public open</option>
                <option value="invite_only">Invite only</option>
                <option value="approval_required">Approval required</option>
              </select>
            </label>
            <label className="community-mgmt-field">
              <span>Participant limit</span>
              <input className="community-mgmt-input" type="number" min={2} max={1000} value={draft.maxParticipants} disabled={locked} onChange={(event) => patchDraft("maxParticipants", Number(event.target.value))} />
            </label>
          </div>
          <label className="community-mgmt-field">
            <span>Description</span>
            <textarea className="community-mgmt-textarea" value={draft.description} maxLength={2000} onChange={(event) => patchDraft("description", event.target.value)} />
          </label>
          <div className="meeting-room-switch-group">
            <p className="meeting-room-switch-label">Capabilities</p>
            <div className="meeting-room-switches">
              {capabilityOptions.map(([key, label]) => (
                <label key={key} className="community-mgmt-toggle">
                  <input type="checkbox" checked={draft.capabilities[key]} disabled={(key === "canPublishVideo" && draft.mode === "voice") || locked} onChange={(event) => patchDraft("capabilities", { ...draft.capabilities, [key]: event.target.checked })} />
                  <span>{label}</span>
                </label>
              ))}
              <label className="community-mgmt-toggle">
                <input type="checkbox" checked={draft.waitingRoomEnabled} disabled={locked} onChange={(event) => patchDraft("waitingRoomEnabled", event.target.checked)} />
                <span>Waiting room</span>
              </label>
              <label className="community-mgmt-toggle">
                <input type="checkbox" checked={draft.audienceMode} disabled={draft.mode !== "stage" || locked} onChange={(event) => patchDraft("audienceMode", event.target.checked)} />
                <span>Audience mode</span>
              </label>
            </div>
          </div>
          <div className="meeting-room-switch-group">
            <p className="meeting-room-switch-label">Moderation</p>
            <div className="meeting-room-switches">
              {moderationOptions.map(([key, label]) => (
                <label key={key} className="community-mgmt-toggle">
                  <input type="checkbox" checked={draft.moderationPolicy[key]} onChange={(event) => patchDraft("moderationPolicy", { ...draft.moderationPolicy, [key]: event.target.checked })} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
          <footer className="community-mgmt-footer">
            <button type="button" className="community-mgmt-action community-mgmt-action--ghost" disabled={busy} onClick={resetEditor}>Reset</button>
            <button type="button" className="community-mgmt-action" disabled={busy || !draft.title.trim()} onClick={() => void submit()}>
              <AppIcon name={editing ? "edit" : "plus"} size="sm" />
              {editing ? "Save room" : "Create room"}
            </button>
          </footer>
        </div>
      ) : (
        <p className="meeting-room-readonly">You can view configured meeting rooms, but your role cannot create or manage them.</p>
      )}

      <div className="meeting-room-list">
        {rooms.length ? rooms.map((room, index) => (
          <article key={room.id} className="meeting-room-card">
            <span className={`meeting-room-mode ${room.mode}`} aria-hidden="true">
              <AppIcon name={room.mode === "voice" ? "voice" : room.mode === "stage" ? "users" : "image"} size="md" />
            </span>
            <div className="meeting-room-summary">
              <strong>{room.title}</strong>
              <span>{modeLabel(room.mode)} · {room.joinPolicy.replace("_", " ")}</span>
              <small>{room.activeSessionCount ? `${room.activeSessionCount} active session` : room.description || "Ready"}</small>
            </div>
            <div className="meeting-room-badges">
              {room.activeSessionCount ? <span className="community-mgmt-badge is-live">Live</span> : null}
              {room.waitingRoomEnabled ? <span className="community-mgmt-badge is-warning">Waiting</span> : null}
              {room.capabilities.canShareScreen ? <span className="community-mgmt-badge">Share</span> : null}
              <span className="community-mgmt-badge">{room.maxParticipants} max</span>
            </div>
            <div className="meeting-room-actions">
              {onOpenRoom ? <button type="button" className="community-mgmt-action community-mgmt-action--ghost" onClick={() => onOpenRoom(room)}>Open</button> : null}
              <button type="button" className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--icon meeting-room-move-up" disabled={!canManage || busy || index === 0} aria-label={`Move ${room.title} up`} onClick={() => void move(room, "up")}>
                <AppIcon name="chevronDown" size="sm" />
              </button>
              <button type="button" className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--icon" disabled={!canManage || busy || index === rooms.length - 1} aria-label={`Move ${room.title} down`} onClick={() => void move(room, "down")}>
                <AppIcon name="chevronDown" size="sm" />
              </button>
              <button type="button" className="community-mgmt-action community-mgmt-action--ghost" disabled={!canManage || busy} onClick={() => {
                setEditing(room);
                setDraft(draftFromRoom(room, community.categories.find((item) => item.channels.some((channel) => channel.id === room.channelId))?.id ?? community.categories[0]?.id ?? null));
              }}>Edit</button>
              <button type="button" className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--danger" disabled={!canManage || busy} onClick={() => { setArchiveRoom(room); setArchiveTitle(""); setArchivePolicy("deny"); }}>
                Remove
              </button>
            </div>
          </article>
        )) : (
          <div className="community-mgmt-empty">
            <strong>No meeting rooms</strong>
            <span>Create a Voice Lounge, Meeting, or Stage room for this community.</span>
          </div>
        )}
      </div>

      {archiveRoom ? (
        <div className="meeting-room-confirm community-mgmt-subcard" role="alertdialog" aria-modal="true">
          <strong>Remove {archiveRoom.title}?</strong>
          <p>Type the room name. Active sessions require an explicit end or transfer policy; audit and attendance metadata remain.</p>
          <label className="community-mgmt-field">
            <span>Confirm room name</span>
            <input className="community-mgmt-input" aria-label="Confirm room name" value={archiveTitle} onChange={(event) => setArchiveTitle(event.target.value)} />
          </label>
          <label className="community-mgmt-field">
            <span>Active session policy</span>
            <select className="community-mgmt-select" value={archivePolicy} onChange={(event) => setArchivePolicy(event.target.value as MeetingRoomArchivePolicy)}>
              <option value="deny">Block if active</option>
              <option value="end">End active session</option>
              <option value="transfer">Transfer active session</option>
            </select>
          </label>
          {archivePolicy === "transfer" ? (
            <label className="community-mgmt-field">
              <span>Replacement room</span>
              <select className="community-mgmt-select" value={replacementId ?? ""} onChange={(event) => setReplacementId(event.target.value || null)}>
                <option value="">Choose replacement</option>
                {rooms.filter((item) => item.id !== archiveRoom.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
          ) : null}
          <footer className="community-mgmt-footer">
            <button type="button" className="community-mgmt-action community-mgmt-action--ghost" onClick={() => setArchiveRoom(null)}>Cancel</button>
            <button type="button" className="community-mgmt-action community-mgmt-action--danger" disabled={busy || archiveTitle !== archiveRoom.title || (archivePolicy === "transfer" && !replacementId)} onClick={() => void archive()}>Confirm remove</button>
          </footer>
        </div>
      ) : null}
    </section>
  );
}
