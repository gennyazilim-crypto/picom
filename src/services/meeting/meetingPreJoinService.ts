import type { MeetingClientJoinRequest } from "../../types/meetingClient";
import type { MeetingPreJoinErrorCode, MeetingPreJoinRoomInfo, MeetingPreJoinSnapshot, MeetingPreJoinSubmitResult } from "../../types/meetingPreJoin";
import { meetingStore } from "../../stores/meetingStore";
import { voiceDeviceService } from "../voiceDeviceService";
import { meetingService } from "./meetingService";

const STORAGE_KEY="picom.meeting-prejoin.v1";
type Listener=()=>void;
type SafePreferences=Pick<MeetingPreJoinSnapshot,"selectedCameraId"|"joinMuted"|"joinCameraOff"|"noiseShieldMode">;
const listeners=new Set<Listener>();
let cameraStream:MediaStream|null=null;

function readPreferences():SafePreferences{try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)??"{}") as Partial<SafePreferences>;return{selectedCameraId:typeof value.selectedCameraId==="string"?value.selectedCameraId:"default",joinMuted:value.joinMuted!==false,joinCameraOff:value.joinCameraOff!==false,noiseShieldMode:value.noiseShieldMode==="standard"?"standard":"off"}}catch{return{selectedCameraId:"default",joinMuted:true,joinCameraOff:true,noiseShieldMode:"off"}}}
const preferences=readPreferences();
const mediaDevices=typeof navigator==="undefined"?undefined:navigator.mediaDevices;
let snapshot:MeetingPreJoinSnapshot={request:null,roomInfo:null,microphonePermission:voiceDeviceService.getSnapshot().permission,cameraPermission:mediaDevices?.getUserMedia?"prompt":"unsupported",microphones:voiceDeviceService.getSnapshot().inputDevices,cameras:[],speakers:voiceDeviceService.getSnapshot().outputDevices,selectedMicrophoneId:voiceDeviceService.getSnapshot().selectedInputId,selectedCameraId:preferences.selectedCameraId,selectedSpeakerId:voiceDeviceService.getSnapshot().selectedOutputId,joinMuted:preferences.joinMuted,joinCameraOff:preferences.joinCameraOff,noiseShieldMode:preferences.noiseShieldMode,cameraPreviewActive:false,cameraPreviewStream:null,microphoneTestActive:false,microphoneLevel:0,speakerTestActive:false,busy:false,error:null};
const emit=(patch:Partial<MeetingPreJoinSnapshot>)=>{snapshot={...snapshot,...patch};for(const listener of listeners)listener()};
const persist=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify({selectedCameraId:snapshot.selectedCameraId,joinMuted:snapshot.joinMuted,joinCameraOff:snapshot.joinCameraOff,noiseShieldMode:snapshot.noiseShieldMode} satisfies SafePreferences))}catch{/* Restricted storage keeps session-only safe preferences. */}};
const error=(code:MeetingPreJoinErrorCode,message:string,recoverable=true)=>({code,message,recoverable});
function stopCameraTracks(){cameraStream?.getTracks().forEach((track)=>track.stop());cameraStream=null}
function cameraError(value:unknown){if(value instanceof DOMException){if(value.name==="NotAllowedError"||value.name==="SecurityError")return error("CAMERA_DENIED","Camera permission was denied. Enable it in system settings and try again.");if(value.name==="NotFoundError"||value.name==="OverconstrainedError")return error("CAMERA_MISSING","No compatible camera is available.");if(value.name==="NotReadableError"||value.name==="AbortError")return error("CAMERA_BUSY","The selected camera is busy in another application.")}return error("DEVICE_UNAVAILABLE","Picom could not open the selected camera.")}
function toCameraOptions(devices:MediaDeviceInfo[]){return devices.filter((device)=>device.kind==="videoinput").map((device,index)=>({deviceId:device.deviceId||"default",label:device.label||`Camera ${index+1}`,isDefault:device.deviceId==="default"||index===0}))}
function videoConstraints():MediaTrackConstraints|boolean{return snapshot.selectedCameraId==="default"?{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:24,max:30}}:{deviceId:{exact:snapshot.selectedCameraId},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:24,max:30}}}

const stopDeviceSync=voiceDeviceService.subscribe((devices)=>emit({microphonePermission:devices.permission,microphones:devices.inputDevices,speakers:devices.outputDevices,selectedMicrophoneId:devices.selectedInputId,selectedSpeakerId:devices.selectedOutputId,microphoneTestActive:devices.microphoneTestActive,microphoneLevel:devices.microphoneLevel,speakerTestActive:devices.outputTestActive,...(devices.error?{error:error(devices.permission==="denied"?"MICROPHONE_DENIED":"DEVICE_UNAVAILABLE",devices.error)}:{})}));
void stopDeviceSync;

export const meetingPreJoinService={
  getSnapshot:()=>snapshot,
  subscribe(listener:Listener){listeners.add(listener);return()=>listeners.delete(listener)},
  configure(request:MeetingClientJoinRequest,roomInfo:MeetingPreJoinRoomInfo):void{emit({request,roomInfo,error:null});void this.refreshDevices()},
  async refreshDevices():Promise<void>{if(!mediaDevices?.enumerateDevices){emit({cameraPermission:"unsupported",cameras:[],error:error("CAMERA_UNSUPPORTED","Camera selection is unavailable in this runtime.")});return}try{const devices=await mediaDevices.enumerateDevices();const cameras=toCameraOptions(devices);const selectedCameraId=cameras.some((item)=>item.deviceId===snapshot.selectedCameraId)?snapshot.selectedCameraId:cameras[0]?.deviceId??"default";emit({cameras,selectedCameraId,...(!cameras.length?{error:error("CAMERA_MISSING","No camera was detected. You can still join with camera off.")}:{})});persist();await voiceDeviceService.refresh(false)}catch{emit({error:error("DEVICE_UNAVAILABLE","Media devices could not be listed.")})}},
  async requestMicrophoneAccess():Promise<boolean>{emit({busy:true,error:null});const devices=await voiceDeviceService.refresh(true);emit({busy:false});if(devices.permission!=="granted"){emit({error:error("MICROPHONE_DENIED",devices.error??"Microphone permission was not granted.")});return false}return true},
  async startCameraPreview():Promise<boolean>{if(!mediaDevices?.getUserMedia){emit({cameraPermission:"unsupported",error:error("CAMERA_UNSUPPORTED","Camera preview is unavailable in this runtime.")});return false}stopCameraTracks();emit({busy:true,error:null,cameraPreviewActive:false,cameraPreviewStream:null});try{cameraStream=await mediaDevices.getUserMedia({audio:false,video:videoConstraints()});const devices=await mediaDevices.enumerateDevices();const cameras=toCameraOptions(devices);emit({busy:false,cameraPermission:"granted",cameras,cameraPreviewActive:true,cameraPreviewStream:cameraStream,error:null});return true}catch(value){const mapped=cameraError(value);emit({busy:false,cameraPermission:mapped.code==="CAMERA_DENIED"?"denied":snapshot.cameraPermission,cameraPreviewActive:false,cameraPreviewStream:null,error:mapped});return false}},
  stopCameraPreview():void{stopCameraTracks();emit({cameraPreviewActive:false,cameraPreviewStream:null})},
  async selectCamera(deviceId:string):Promise<boolean>{if(!snapshot.cameras.some((device)=>device.deviceId===deviceId))return false;emit({selectedCameraId:deviceId,error:null});persist();return snapshot.cameraPreviewActive?this.startCameraPreview():true},
  selectMicrophone:(deviceId:string)=>voiceDeviceService.selectInput(deviceId),
  selectSpeaker:(deviceId:string)=>voiceDeviceService.selectOutput(deviceId),
  testMicrophone:()=>voiceDeviceService.startMicrophoneTest(),
  stopMicrophoneTest:()=>voiceDeviceService.stopMicrophoneTest(),
  testSpeaker:()=>voiceDeviceService.testOutput(),
  setJoinMuted(joinMuted:boolean):void{emit({joinMuted});persist()},
  setJoinCameraOff(joinCameraOff:boolean):void{emit({joinCameraOff});persist()},
  setNoiseShield(enabled:boolean):void{const supported=voiceDeviceService.getSnapshot().supportedConstraints.noiseSuppression;if(enabled&&!supported){emit({noiseShieldMode:"off",error:error("DEVICE_UNAVAILABLE","Noise Shield is unavailable for this microphone/runtime.")});meetingStore.setNoiseShield(true,false,"unavailable");return}const noiseShieldMode=enabled?"standard":"off";voiceDeviceService.updateProcessingOptions({noiseSuppression:enabled,echoCancellation:enabled,autoGainControl:enabled});emit({noiseShieldMode,error:null});meetingStore.setNoiseShield(enabled,enabled,enabled?"applied":"off");persist()},
  async submit():Promise<MeetingPreJoinSubmitResult>{const request=snapshot.request;if(!request)return{ok:false,error:{code:"MEETING_CONTEXT_INVALID",message:"Choose a meeting before joining.",recoverable:false}};emit({busy:true,error:null});voiceDeviceService.stopMicrophoneTest();this.stopCameraPreview();const next:MeetingClientJoinRequest={...request,joinMuted:snapshot.joinMuted,joinCameraOff:snapshot.joinCameraOff,cameraDeviceId:snapshot.selectedCameraId,noiseShield:snapshot.noiseShieldMode==="standard",requestedSources:{...request.requestedSources,camera:request.requestedSources.camera&&!snapshot.joinCameraOff&&snapshot.cameraPermission==="granted"}};const result=await meetingService.join(next,true);emit({busy:false,...(!result.ok?{error:error("TOKEN_FAILED",result.error.message,result.error.recoverable)}:{})});return result},
  dispose():void{this.stopCameraPreview();voiceDeviceService.stopMicrophoneTest();emit({request:null,roomInfo:null,error:null,busy:false})},
};
