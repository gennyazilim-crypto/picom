import { sleepWakeResumeService } from "../sleepWakeResumeService";
import { voiceDeviceService } from "../voiceDeviceService";
import { meetingLiveKitAdapter } from "./meetingLiveKitAdapter";
import { meetingPreJoinService } from "./meetingPreJoinService";

export type MeetingDeviceRecoveryNotice=Readonly<{kind:"device"|"permission"|"resume";message:string;recovered:boolean}>;

export const meetingDeviceRecoveryService={
  start(onNotice:(notice:MeetingDeviceRecoveryNotice)=>void):()=>void{
    let stopped=false,inFlight:Promise<void>|null=null,lastRevision=voiceDeviceService.getSnapshot().deviceRevision,lastPermission=voiceDeviceService.getSnapshot().permission;
    const recover=(kind:MeetingDeviceRecoveryNotice["kind"],message:string):Promise<void>=>{
      if(inFlight)return inFlight;
      inFlight=(async()=>{await voiceDeviceService.refresh(false);await meetingPreJoinService.refreshDevices();const camera=meetingPreJoinService.getSnapshot();const recovered=await meetingLiveKitAdapter.recoverMediaDevices(camera.selectedCameraId,camera.cameraPermission);if(!stopped)onNotice({kind,message:camera.notice??voiceDeviceService.getSnapshot().notice??message,recovered})})().finally(()=>{inFlight=null});
      return inFlight;
    };
    const stopVoice=voiceDeviceService.subscribe((next)=>{const revisionChanged=next.deviceRevision!==lastRevision,permissionChanged=next.permission!==lastPermission;lastRevision=next.deviceRevision;lastPermission=next.permission;if((next.notice||next.error)&&!stopped)onNotice({kind:permissionChanged?"permission":"device",message:next.notice??next.error??"Meeting device state changed.",recovered:false});if(revisionChanged||permissionChanged)void recover(permissionChanged?"permission":"device","Picom refreshed meeting devices after a hardware or permission change.")});
    const stopResume=sleepWakeResumeService.onResume(()=>{void recover("resume","Picom refreshed meeting devices after the app resumed.")});
    let cameraStatus:PermissionStatus|null=null;let cameraChange:(()=>void)|null=null;
    if(navigator.permissions?.query)void navigator.permissions.query({name:"camera" as PermissionName}).then((status)=>{if(stopped)return;cameraStatus=status;cameraChange=()=>{void meetingPreJoinService.handleCameraPermissionChange(status.state).then(()=>recover("permission","Camera permission changed."))};status.addEventListener("change",cameraChange)}).catch(()=>undefined);
    return()=>{stopped=true;stopVoice();stopResume();if(cameraStatus&&cameraChange)cameraStatus.removeEventListener("change",cameraChange);cameraStatus=null;cameraChange=null;inFlight=null};
  },
};
