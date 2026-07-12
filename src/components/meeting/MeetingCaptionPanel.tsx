import { useEffect, useState } from "react";
import { meetingService } from "../../services/meeting/meetingService";
import { meetingCaptionService } from "../../services/meeting/meetingCaptionService";
import type { MeetingCaptionLanguage, MeetingCaptionSnapshot } from "../../types/meetingCaptions";
import { AppIcon } from "../AppIcon";

const languageLabels:Record<MeetingCaptionLanguage,string>={en:"English",tr:"Turkish",de:"German",es:"Spanish",fr:"French"};
const statusLabels:Record<MeetingCaptionSnapshot["status"],string>={idle:"Ready",awaiting_consent:"Waiting for consent",starting:"Starting provider",active:"Live",stopping:"Stopping",stopped:"Stopped",failed:"Provider error",unavailable:"Unavailable"};

export function MeetingCaptionPanel({caption}:{caption:MeetingCaptionSnapshot}){
  const [language,setLanguage]=useState<MeetingCaptionLanguage>(caption.language);const busy=caption.operation!=="idle";
  useEffect(()=>{if(["idle","stopped","unavailable"].includes(caption.status))setLanguage(caption.language)},[caption.language,caption.status]);
  const request=async()=>{await meetingCaptionService.requestCaptions(language)};
  const consent=async(decision:"accepted"|"declined")=>{const accepted=await meetingCaptionService.recordConsent(decision);if(accepted&&decision==="accepted")void meetingService.refreshAuthorization()};
  return <section className="meeting-caption-panel" aria-label="Live captions and transcript">
    <div className="meeting-caption-panel__status"><span className={`meeting-caption-state meeting-caption-state--${caption.status}`}><i aria-hidden="true"/>{statusLabels[caption.status]}</span><small>Deepgram Nova-3 via a server-side LiveKit Agent</small></div>
    <div className="meeting-caption-panel__privacy"><AppIcon name="lock" size="sm"/><span><strong>Ephemeral by design</strong><small>Audio and transcript text are not stored by Picom in this Full MVP.</small></span></div>
    {caption.error?<p className="meeting-caption-panel__error" role="alert">{caption.error}</p>:null}
    {caption.consentRequired&&caption.consentDecision===null?<div className="meeting-caption-consent"><strong>Allow live transcription?</strong><p>Your meeting audio will be sent to Deepgram while captions are active. Declining prevents transcription and stops an active caption session.</p><div><button type="button" disabled={busy} onClick={()=>void consent("declined")} className="secondary">Decline</button><button type="button" disabled={busy} onClick={()=>void consent("accepted")}>Allow captions</button></div></div>:null}
    {caption.status==="idle"||caption.status==="stopped"?<div className="meeting-caption-start"><label htmlFor="meeting-caption-language">Spoken language</label><select id="meeting-caption-language" value={language} disabled={busy||!caption.canStart} onChange={(event)=>setLanguage(event.target.value as MeetingCaptionLanguage)}>{Object.entries(languageLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>{caption.canStart?<button type="button" disabled={busy||!caption.configured} onClick={()=>void request()}><AppIcon name="hash" size="sm"/>Request captions</button>:<p>Only a host or authorized cohost can request room-wide captions.</p>}</div>:null}
    {caption.status==="awaiting_consent"?<p className="meeting-caption-panel__notice">Captions start only after every active participant accepts. {caption.pendingConsentCount} response{caption.pendingConsentCount===1?"":"s"} remaining.</p>:null}
    {caption.status==="active"?<><div className="meeting-caption-controls"><button type="button" className={caption.displayEnabled?"active":""} aria-pressed={caption.displayEnabled} onClick={()=>meetingCaptionService.setDisplayEnabled(!caption.displayEnabled)}>{caption.displayEnabled?"Hide overlay":"Show overlay"}</button><label>Text size<select value={caption.fontSize} onChange={(event)=>meetingCaptionService.setFontSize(event.target.value as MeetingCaptionSnapshot["fontSize"])}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>{caption.canStart?<button type="button" className="danger" disabled={busy} onClick={()=>void meetingCaptionService.stopCaptions()}>Stop captions</button>:null}</div><div className="meeting-caption-transcript" aria-live="polite">{caption.segments.length?<>{caption.segments.map((segment)=><article key={segment.id} className={segment.isFinal?"is-final":"is-interim"}><strong>{segment.speakerName}</strong><p>{segment.text}</p></article>)}</>:<div className="meeting-caption-empty"><AppIcon name="hash" size="lg"/><strong>Listening for speech</strong><span>Caption text will appear here without being written to Picom storage.</span></div>}</div></>:null}
  </section>;
}
