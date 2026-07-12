import type { MeetingCaptionSnapshot } from "../../types/meetingCaptions";
import type { MeetingClientSnapshot } from "../../types/meetingClient";
import { AppIcon, type IconName } from "../AppIcon";
import "./MeetingMediaPrivacyIndicator.css";

type Indicator=Readonly<{key:string;icon:IconName;label:string;kind:"microphone"|"camera"|"screen"|"captions"}>;

export function MeetingMediaPrivacyIndicator({snapshot,captions}:{snapshot:MeetingClientSnapshot;captions:MeetingCaptionSnapshot}){
  const connected=snapshot.phase==="connected"||snapshot.phase==="reconnecting";const active:Indicator[]=[];
  if(connected&&!snapshot.localMedia.muted&&snapshot.capabilities.canPublishAudio)active.push({key:"mic",icon:"microphone",label:"Microphone live",kind:"microphone"});
  if(connected&&snapshot.localMedia.cameraEnabled)active.push({key:"camera",icon:"image",label:"Camera live",kind:"camera"});
  if(connected&&snapshot.localMedia.screenSharing)active.push({key:"screen",icon:"maximize",label:"Screen sharing",kind:"screen"});
  if(captions.status==="active")active.push({key:"captions",icon:"hash",label:"Captions live",kind:"captions"});
  else if(captions.status==="awaiting_consent"||captions.status==="starting")active.push({key:"captions-pending",icon:"hash",label:captions.status==="awaiting_consent"?"Caption consent":"Captions starting",kind:"captions"});
  const label=active.length?active.map((item)=>item.label).join(", "):connected?"Local microphone, camera, screen share, and captions are off":"No active meeting media";
  return <span className={`meeting-media-privacy${active.length?" has-active-media":""}`} role="status" aria-live="polite" aria-label={label} title="Media is sent through the configured meeting provider only while the corresponding control is active. The Full MVP has no meeting recording feature.">{active.length?active.map((item)=><b key={item.key} data-kind={item.kind}><AppIcon name={item.icon} size="xs"/><em>{item.label}</em></b>):<b data-kind="off"><AppIcon name="lock" size="xs"/><em>Media off</em></b>}</span>;
}
