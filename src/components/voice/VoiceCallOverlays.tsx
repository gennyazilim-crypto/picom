import "./voice-call-overlays.css";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { IncomingVoiceCall, OutgoingVoiceCall } from "../../services/voice/voiceCallInviteService";
import { AppIcon } from "../AppIcon";

type VoiceCallOverlaysProps = Readonly<{
  incoming: IncomingVoiceCall | null;
  outgoing: OutgoingVoiceCall | null;
  onAccept: () => void;
  onDecline: () => void;
  onMessage?: () => void;
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

function incomingSubtitle(call: IncomingVoiceCall): string {
  if (call.room.kind === "community") {
    return `${call.room.communityName} · ${call.room.channelName}`;
  }
  return "Incoming call";
}

function roomSecondary(call: OutgoingVoiceCall): string {
  return call.room.kind === "community" ? call.room.channelName : "Direct call";
}

function outgoingText(call: OutgoingVoiceCall): { primary: string; secondary: string } {
  switch (call.status) {
    case "ringing":
      return { primary: `Ringing ${call.target.name}…`, secondary: roomSecondary(call) };
    case "accepted":
      return { primary: `${call.target.name} joined`, secondary: roomSecondary(call) };
    case "declined":
      return { primary: `${call.target.name} declined`, secondary: "Call ended" };
    case "timeout":
      return { primary: "No answer", secondary: `${call.target.name} didn't pick up` };
    case "canceled":
      return { primary: "Call canceled", secondary: call.target.name };
    case "failed":
      return {
        primary: "Call could not be sent",
        secondary: call.failureMessage?.trim() || "Try again in a moment",
      };
    default:
      return { primary: call.target.name, secondary: roomSecondary(call) };
  }
}

export function VoiceCallOverlays({
  incoming,
  outgoing,
  onAccept,
  onDecline,
  onMessage,
  onCancelOutgoing,
  onDismissOutgoing,
}: VoiceCallOverlaysProps) {
  const reduceMotion = useReducedMotion();
  const outgoingCopy = outgoing ? outgoingText(outgoing) : null;

  return (
    <>
      <AnimatePresence>
        {incoming ? (
        <motion.div
          key="incoming-voice-call"
          className="voice-call-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Incoming voice call from ${incoming.caller.name}`}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
        >
          <motion.article
            className="voice-call-card voice-call-card--incoming"
            initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34, mass: 0.75 }}
          >
            <div className="voice-call-card__media" aria-hidden="true">
              {incoming.caller.avatarUrl ? (
                <img src={incoming.caller.avatarUrl} alt="" />
              ) : (
                <span className="voice-call-card__initials">{initials(incoming.caller.name)}</span>
              )}
              <span className="voice-call-card__pulse" />
            </div>

            <div className="voice-call-card__actions" role="group" aria-label="Incoming call actions">
              <button
                type="button"
                className="voice-call-fab voice-call-fab--message"
                aria-label={onMessage ? `Message ${incoming.caller.name} instead` : `Decline call from ${incoming.caller.name}`}
                title={onMessage ? "Message instead" : "Decline"}
                onClick={onMessage ?? onDecline}
              >
                <AppIcon name="inbox" size="md" />
              </button>
              <button
                type="button"
                className="voice-call-fab voice-call-fab--accept"
                aria-label={`Answer call from ${incoming.caller.name}`}
                title="Answer"
                onClick={onAccept}
              >
                <AppIcon name="voice" size="md" />
              </button>
            </div>

            <div className="voice-call-card__meta">
              <h2 className="voice-call-card__name">{incoming.caller.name}</h2>
              <p className="voice-call-card__subtitle">{incomingSubtitle(incoming)}</p>
            </div>

            <button type="button" className="voice-call-card__decline" onClick={onDecline}>
              Decline
            </button>
          </motion.article>
        </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {outgoing && outgoingCopy ? (
        <motion.div
          key="outgoing-voice-call"
          className={`voice-call-bar voice-call-bar--${outgoing.status}`}
          role="status"
          aria-live="polite"
          initial={reduceMotion ? { x: "-50%" } : { x: "-50%", opacity: 0, y: 14, scale: 0.97 }}
          animate={{ x: "-50%", opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { x: "-50%", opacity: 0, y: 10, scale: 0.98 }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 440, damping: 34, mass: 0.7 }}
        >
          <span className="voice-call-bar__dot" aria-hidden="true" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={outgoing.status}
              className="voice-call-bar__text"
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: reduceMotion ? 0 : 0.12 }}
            >
              {outgoingCopy.primary}
              <small>{outgoingCopy.secondary}</small>
            </motion.span>
          </AnimatePresence>
          {outgoing.status === "ringing" ? (
            <button type="button" className="voice-call-bar__action" onClick={onCancelOutgoing}>Cancel</button>
          ) : (
            <button type="button" className="voice-call-bar__action voice-call-bar__action--ghost" onClick={onDismissOutgoing}>Dismiss</button>
          )}
        </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
