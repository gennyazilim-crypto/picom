import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { MeetingClientParticipant, MeetingClientSnapshot } from "../../types/meetingClient";
import type { MeetingParticipantModerationAction } from "../../types/meetingParticipantControls";
import type { OverlayMenuItem } from "../../state/useOverlayState";
import { meetingService } from "../../services/meeting/meetingService";
import { meetingParticipantLocalControlService } from "../../services/meeting/meetingParticipantLocalControlService";
import { meetingParticipantModerationService } from "../../services/meeting/meetingParticipantModerationService";
import { meetingParticipantNavigationService } from "../../services/meeting/meetingParticipantNavigationService";
import { ReportModal, type ReportModalTarget } from "../ReportModal";
import { DesktopContextMenu } from "../DesktopContextMenu";
import "./MeetingParticipantActionsProvider.css";

type MeetingParticipantMenuAction = "view_profile" | "send_message" | "pin" | "toggle_local_mute" | "toggle_self_view" | "toggle_self_microphone" | "toggle_self_camera" | "report" | MeetingParticipantModerationAction;

type MenuState = Readonly<{ participantId: string; x: number; y: number; trigger: HTMLElement | null }>;
type VolumeState = Readonly<{ participantId: string; x: number; y: number }>;
type ParticipantActionsContextValue = Readonly<{ openMenu: (event: MouseEvent<HTMLElement>, participant: MeetingClientParticipant) => void }>;
const ParticipantActionsContext = createContext<ParticipantActionsContextValue | null>(null);

export function useMeetingParticipantActionsOptional(): ParticipantActionsContextValue | null {
  return useContext(ParticipantActionsContext);
}

export function MeetingParticipantActionsProvider({ snapshot, children }: { snapshot: MeetingClientSnapshot; children: ReactNode }) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [volumeEditor, setVolumeEditor] = useState<VolumeState | null>(null);
  const [busyAction, setBusyAction] = useState<MeetingParticipantMenuAction | null>(null);
  const [notice, setNotice] = useState("");
  const [reportTarget, setReportTarget] = useState<ReportModalTarget | null>(null);
  const statusTimer = useRef<number | null>(null);
  const sessionKey = `${snapshot.context?.roomId ?? "none"}:${snapshot.context?.sessionId ?? "none"}`;
  const priorSessionKey = useRef(sessionKey);
  const selected = menu ? snapshot.participantsById[menu.participantId] : null;
  const volumeParticipant = volumeEditor ? snapshot.participantsById[volumeEditor.participantId] : null;
  const localParticipant = snapshot.participantIds.map((id) => snapshot.participantsById[id]).find((participant) => participant?.isLocal);
  const controls = selected ? meetingParticipantLocalControlService.get(selected.identity) : null;

  const announce = useCallback((message: string) => {
    setNotice(message);
    if (statusTimer.current !== null) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setNotice(""), 4_000);
  }, []);
  useEffect(() => () => { if (statusTimer.current !== null) window.clearTimeout(statusTimer.current); }, []);
  useEffect(() => {
    if (priorSessionKey.current === sessionKey) return;
    priorSessionKey.current = sessionKey;
    meetingParticipantLocalControlService.reset();
    setMenu(null);
    setVolumeEditor(null);
  }, [sessionKey]);
  useEffect(() => { if (menu && !selected) setMenu(null); }, [menu, selected]);

  const openMenu = useCallback((event: MouseEvent<HTMLElement>, participant: MeetingClientParticipant) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setNotice("");
    setMenu({ participantId: participant.id, x: event.clientX || rect.right, y: event.clientY || rect.bottom, trigger: event.currentTarget });
  }, []);
  const closeMenu = useCallback(() => { if (!busyAction) setMenu(null); }, [busyAction]);

  const run = useCallback(async (action: MeetingParticipantMenuAction) => {
    if (!selected || busyAction) return;
    if (action === "view_profile" || action === "send_message") {
      const opened = selected.userId ? (action === "view_profile" ? meetingParticipantNavigationService.openProfile(selected.userId) : meetingParticipantNavigationService.openDirectMessage(selected.userId)) : false;
      if (!opened) announce("This participant profile is not available.");
      setMenu(null);
      return;
    }
    if (action === "pin") {
      meetingService.setFocus(snapshot.focusedParticipantId === selected.id ? null : selected.id);
      setMenu(null);
      return;
    }
    if (action === "toggle_local_mute") {
      const current = meetingParticipantLocalControlService.get(selected.identity);
      meetingParticipantLocalControlService.setLocallyMuted(selected.identity, !current.locallyMuted);
      announce(current.locallyMuted ? `${selected.displayName} is audible again on this device.` : `${selected.displayName} is muted only for you.`);
      return;
    }
    if (action === "toggle_self_view") {
      const current = meetingParticipantLocalControlService.get(selected.identity);
      meetingParticipantLocalControlService.setSelfViewVisible(selected.identity, !current.selfViewVisible);
      setMenu(null);
      return;
    }
    if (action === "toggle_self_microphone") {
      setBusyAction(action);
      const ok = await meetingService.setMuted(!snapshot.localMedia.muted);
      setBusyAction(null);
      announce(ok ? "Your microphone setting was updated." : "Your microphone setting could not be updated.");
      return;
    }
    if (action === "toggle_self_camera") {
      setBusyAction(action);
      const ok = await meetingService.setCameraEnabled(!snapshot.localMedia.cameraEnabled);
      setBusyAction(null);
      announce(ok ? "Your camera setting was updated." : "Your camera setting could not be updated.");
      return;
    }
    if (action === "report") {
      if (!selected.userId || !localParticipant?.userId || !snapshot.context) { announce("Reporting is unavailable for this participant."); return; }
      setReportTarget({ targetType: "user", targetId: selected.userId, label: `${selected.displayName}${selected.username ? ` (@${selected.username})` : ""}`, communityId: snapshot.context.communityId, channelId: snapshot.context.channelId });
      setMenu(null);
      return;
    }
    if (action === "remove" && !window.confirm(`Remove ${selected.displayName} from this meeting?`)) return;
    setBusyAction(action);
    const result = await meetingParticipantModerationService.perform(snapshot, selected, action);
    setBusyAction(null);
    announce(result.message);
    if (result.ok && action === "remove") setMenu(null);
  }, [announce, busyAction, localParticipant?.userId, selected, snapshot]);

  const menuItems = useMemo<OverlayMenuItem[]>(() => {
    if (!selected) return [];
    const item = (label: string, action: MeetingParticipantMenuAction, icon: OverlayMenuItem["icon"], options: Pick<OverlayMenuItem, "detail" | "tone" | "disabled"> = {}): OverlayMenuItem => ({ label, icon, ...options, onSelect: () => { void run(action); } });
    const items: OverlayMenuItem[] = [
      item("View profile", "view_profile", "user", { disabled: !selected.userId }),
      ...(!selected.isLocal ? [item("Send message", "send_message", "inbox", { disabled: !selected.userId })] : []),
      item(snapshot.focusedParticipantId === selected.id ? "Unpin" : "Pin", "pin", "pin", { detail: "Only for you" }),
    ];
    if (!selected.isLocal) {
      const controls = meetingParticipantLocalControlService.get(selected.identity);
      items.push({ label: `Local volume ${Math.round(controls.volume * 100)}%`, icon: controls.locallyMuted ? "volumeOff" : "microphone", detail: "Only on this device", onSelect: () => setVolumeEditor({ participantId: selected.id, x: menu?.x ?? 0, y: menu?.y ?? 0 }) });
      items.push(item(controls.locallyMuted ? "Unmute locally" : "Mute locally", "toggle_local_mute", "volumeOff", { detail: "Does not mute them for anyone else" }));
    } else {
      const controls = meetingParticipantLocalControlService.get(selected.identity);
      items.push(item(controls.selfViewVisible ? "Hide self view" : "Show self view", "toggle_self_view", "eye", { detail: "Camera publishing is unchanged" }));
      items.push(item(snapshot.localMedia.muted ? "Unmute my microphone" : "Mute my microphone", "toggle_self_microphone", "microphone"));
      items.push(item(snapshot.localMedia.cameraEnabled ? "Turn my camera off" : "Turn my camera on", "toggle_self_camera", "image"));
    }
    if (snapshot.capabilities.canManageParticipants && !selected.isLocal) {
      const onStage = ["host", "cohost", "speaker"].includes(selected.role);
      items.push(item("Mute participant for everyone", "mute", "microphone", { detail: "Server authorized" }));
      items.push(item(onStage ? "Move to audience" : "Promote to speaker", onStage ? "demote" : "promote", "users", { detail: "Server authorized" }));
      if (selected.screenSharing) items.push(item("Stop screen share", "deny_screen_share", "image", { detail: "Server authorized" }));
      items.push(item("Remove participant", "remove", "trash", { tone: "danger", detail: "Requires confirmation" }));
    }
    if (!selected.isLocal) items.push(item("Report participant", "report", "bell", { disabled: !selected.userId }));
    return items;
  }, [menu?.x, menu?.y, run, selected, snapshot.capabilities.canManageParticipants, snapshot.focusedParticipantId, snapshot.localMedia.cameraEnabled, snapshot.localMedia.muted]);

  const contextValue = useMemo<ParticipantActionsContextValue>(() => ({ openMenu }), [openMenu]);
  return <ParticipantActionsContext.Provider value={contextValue}>
    {children}
    {selected && controls && menu ? <DesktopContextMenu x={menu.x} y={menu.y} width={284} height={Math.min(620, menuItems.length * 47 + 16)} ariaLabel={`Actions for ${selected.displayName}`} items={menuItems.map((entry) => ({ ...entry, disabled: entry.disabled || busyAction !== null }))} onClose={closeMenu} /> : null}
    {volumeParticipant && volumeEditor ? <DesktopContextMenu x={volumeEditor.x} y={volumeEditor.y} width={264} height={112} ariaLabel={`Local volume for ${volumeParticipant.displayName}`} items={[]} onClose={() => setVolumeEditor(null)}><label className="meeting-participant-volume"><span><strong>Local volume</strong><small>{volumeParticipant.displayName} - only on this device</small></span><output>{Math.round(meetingParticipantLocalControlService.get(volumeParticipant.identity).volume * 100)}%</output><input data-menu-focus aria-label={`Local volume for ${volumeParticipant.displayName}`} type="range" min="0" max="100" step="5" value={Math.round(meetingParticipantLocalControlService.get(volumeParticipant.identity).volume * 100)} onChange={(event) => meetingParticipantLocalControlService.setVolume(volumeParticipant.identity, Number(event.target.value) / 100)} /></label></DesktopContextMenu> : null}
    {reportTarget && localParticipant?.userId ? <ReportModal target={reportTarget} reporterId={localParticipant.userId} onClose={() => setReportTarget(null)} onResult={(message) => announce(message)} /> : null}
    {notice ? <span className="meeting-participant-actions__status" role="status" aria-live="polite">{notice}</span> : null}
  </ParticipantActionsContext.Provider>;
}
