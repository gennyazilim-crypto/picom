import type { MeetingCaptionSnapshot } from "../../types/meetingCaptions";

export function MeetingCaptionsOverlay({caption}:{caption:MeetingCaptionSnapshot}){if(caption.status!=="active"||!caption.displayEnabled||caption.segments.length===0)return null;const visible=caption.segments.slice(-2);return <div className={`meeting-captions-overlay meeting-captions-overlay--${caption.fontSize}`} aria-live="polite" aria-label="Live captions">{visible.map((segment)=><p key={segment.id}><strong>{segment.speakerName}</strong><span>{segment.text}</span></p>)}</div>}
