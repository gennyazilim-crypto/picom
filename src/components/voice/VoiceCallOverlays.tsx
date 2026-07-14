import "./voice-call-overlays.css";
import type { IncomingVoiceCall, OutgoingVoiceCall } from "../../services/voice/voiceCallInviteService";

type VoiceCallOverlaysProps = Readonly<{
  incoming: IncomingVoiceCall | null;
  outgoing: OutgoingVoiceCall | null;
  onAccept: () => void;
  onDecline: () => void;
  onCancelOutgoing: () => void;
  onDismissOutgoing: () => void;
}>;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return `${first}${second}`.toUpperCase();
}

function outgoingText(call: OutgoingVoiceCall): { primary: string; secondary: string } {
  switch (call.status) {
    case "ringing":
      return { primary: `Ringing ${call.target.name}…`, secondary: call.room.channelName };
    case "accepted":
      return { primary: `${call.target.name} joined`, secondary: call.room.channelName };
    case "declined":
      return { primary: `${call.target.name} declined`, secondary: "Call ended" };
    case "timeout":
      return { primary: "No answer", secondary: `${call.target.name} didn't pick up` };
    case "canceled":
      return { primary: "Call canceled", secondary: call.target.name };
    case "failed":
      return { primary: "Call could not be sent", secondary: "Try again in a moment" };
    default:
      return { primary: call.target.name, secondary: call.room.channelName };
  }
}

export function VoiceCallOverlays({ incoming, outgoing, onAccept, onDecline, onCancelOutgoing, onDismissOutgoing }: VoiceCallOverlaysProps) {
  return (
    <>
      {incoming ? (
        <div className="voice-call-overlay" role="dialog" aria-modal="true" aria-label={`Incoming voice call from ${incoming.caller.name}`}>
          <div className="voice-call-card">
            <div className="voice-call-avatar" aria-hidden="true">
              {incoming.caller.avatarUrl ? <img src={incoming.caller.avatarUrl} alt="" /> : initials(incoming.caller.name)}
            </div>
            <div>
              <div className="voice-call-title">{incoming.caller.name}</div>
              <div className="voice-call-subtitle">
                is inviting you to voice in <strong>{incoming.room.channelName}</strong>
                <br />
                {incoming.room.communityName}
              </div>
            </div>
            <div className="voice-call-actions">
              <button type="button" className="voice-call-btn voice-call-btn--decline" onClick={onDecline}>Decline</button>
              <button type="button" className="voice-call-btn voice-call-btn--accept" onClick={onAccept}>Join</button>
            </div>
          </div>
        </div>
      ) : null}

      {outgoing ? (
        <div className={`voice-call-bar voice-call-bar--${outgoing.status}`} role="status">
          <span className="voice-call-bar__dot" aria-hidden="true" />
          <span className="voice-call-bar__text">
            {outgoingText(outgoing).primary}
            <small>{outgoingText(outgoing).secondary}</small>
          </span>
          {outgoing.status === "ringing" ? (
            <button type="button" className="voice-call-bar__action" onClick={onCancelOutgoing}>Cancel</button>
          ) : (
            <button type="button" className="voice-call-bar__action voice-call-bar__action--ghost" onClick={onDismissOutgoing}>Dismiss</button>
          )}
        </div>
      ) : null}
    </>
  );
}
