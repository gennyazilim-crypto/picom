import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";

export type MeetingScreenShareLeaseErrorCode = "CONFLICT" | "FORBIDDEN" | "UNAVAILABLE";
export type MeetingScreenShareLeaseResult = Readonly<{ ok: true }> | Readonly<{ ok: false; code: MeetingScreenShareLeaseErrorCode }>;
type RpcClient={rpc:(name:string,args:Record<string,unknown>)=>Promise<{data:unknown;error:{message:string}|null}>};
const mockLeases = new Map<string,string>();

function errorCode(message:string):MeetingScreenShareLeaseErrorCode{return message.includes("CONFLICT")?"CONFLICT":message.includes("FORBIDDEN")||message.includes("AUTH")?"FORBIDDEN":"UNAVAILABLE";}

export const meetingScreenShareLeaseService = {
  async claim(roomId:string,sessionId:string):Promise<MeetingScreenShareLeaseResult>{
    if(dataSourceService.getStatus().isMock){const active=mockLeases.get(roomId);if(active&&active!==sessionId)return{ok:false,code:"CONFLICT"};mockLeases.set(roomId,sessionId);return{ok:true};}
    const client=getSupabaseClient();if(!client)return{ok:false,code:"UNAVAILABLE"};
    const{error}=await(client as unknown as RpcClient).rpc("claim_meeting_screen_share",{target_room_id:roomId,target_session_id:sessionId,target_lease_seconds:7200});
    return error?{ok:false,code:errorCode(error.message)}:{ok:true};
  },
  async release(roomId:string,sessionId:string):Promise<boolean>{
    if(dataSourceService.getStatus().isMock){if(mockLeases.get(roomId)===sessionId)mockLeases.delete(roomId);return true;}
    const client=getSupabaseClient();if(!client)return false;const{data,error}=await(client as unknown as RpcClient).rpc("release_meeting_screen_share",{target_room_id:roomId,target_session_id:sessionId});return !error&&data===true;
  },
};
