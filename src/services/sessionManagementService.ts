import { authService, type AuthServiceSession } from "./authService";
import { dataSourceService } from "./dataSourceService";
import { platformService } from "./platformService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const DEVICE_KEY="picom.sessionDevice.v2";
export type SessionDeviceSummary=Readonly<{id:string;provider:AuthServiceSession["provider"];userId:string|null;email:string|null;displayName:string|null;deviceLabel:string;platformLabel:string;runtimeLabel:string;createdAt:string|null;lastUsedAt:string;expiresAt:string|null;current:boolean;revokedAt:string|null;status:"active"|"expired"|"revoked"|"placeholder"}>;
export type ActiveSessionsSummary=Readonly<{sessions:SessionDeviceSummary[];message:string;requiresSignIn:boolean}>;
export type SessionManagementResult<T>=Readonly<{ok:true;data:T}>|Readonly<{ok:false;message:string;requiresSignIn?:boolean}>;

function deviceId(){try{const existing=localStorage.getItem(DEVICE_KEY);if(existing&&/^[a-zA-Z0-9_-]{8,128}$/.test(existing))return existing;const next=`desktop_${crypto.randomUUID().replace(/-/g,"")}`;localStorage.setItem(DEVICE_KEY,next);return next}catch{return "desktop_restricted"}}
function platform(){const value=platformService.getInfo();return{deviceLabel:`${value.platformLabel} ${value.runtimeLabel}`,platformLabel:value.platformLabel,runtimeLabel:value.runtimeLabel}}
function mockSession(session:AuthServiceSession|null):SessionDeviceSummary{const p=platform(),now=new Date().toISOString();return{id:`mock-${deviceId()}`,provider:"mock",userId:session?.user?.id??"mock-current-user",email:session?.user?.email??"mock@picom.local",displayName:session?.user?.displayName??"Picom Mock User",...p,createdAt:now,lastUsedAt:now,expiresAt:null,current:true,revokedAt:null,status:"active"}}

export const sessionManagementService={
  async ensureCurrentSessionRegistered():Promise<boolean>{
    if(dataSourceService.getStatus().isMock)return true;const client=getSupabaseClient();if(!client)return false;const p=platform();const result=await client.rpc("register_current_device_session",{target_device_id:deviceId(),target_device_label:p.deviceLabel,target_platform_label:p.platformLabel,target_runtime_label:p.runtimeLabel});return !result.error;
  },
  async getActiveSessions():Promise<SessionManagementResult<ActiveSessionsSummary>>{
    const auth=await authService.getCurrentSession();if(!auth.ok)return{ok:false,message:auth.error.message,requiresSignIn:auth.error.code==="AUTH_SESSION_EXPIRED"};
    if(dataSourceService.getStatus().isMock)return{ok:true,data:{sessions:[mockSession(auth.data)],message:"Mock current session. No authentication tokens are displayed.",requiresSignIn:false}};
    const client=getSupabaseClient();if(!client)return{ok:false,message:"Session management is unavailable."};
    await this.ensureCurrentSessionRegistered();const{data,error}=await client.rpc("list_current_user_device_sessions");if(error)return{ok:false,message:"Picom could not load active sessions."};
    return{ok:true,data:{sessions:(data??[]).map((row)=>({id:row.id,provider:"supabase" as const,userId:auth.data?.user?.id??null,email:auth.data?.user?.email??null,displayName:auth.data?.user?.displayName??null,deviceLabel:row.device_label,platformLabel:row.platform_label,runtimeLabel:row.runtime_label,createdAt:row.created_at,lastUsedAt:row.last_used_at,expiresAt:row.expires_at,current:row.current,revokedAt:row.revoked_at,status:row.revoked_at?"revoked":row.expires_at&&Date.parse(row.expires_at)<=Date.now()?"expired":"active"})),message:"Device session metadata is backend-authoritative and contains no raw authentication tokens.",requiresSignIn:false}};
  },
  async revokeSession(sessionId:string):Promise<SessionManagementResult<{message:string}>>{const listed=await this.getActiveSessions();if(listed.ok&&listed.data.sessions.some((item)=>item.id===sessionId&&item.current))return{ok:false,message:"Use Log out to end the current desktop session safely."};return{ok:false,message:"Use Revoke other sessions to revoke provider refresh sessions and registered devices together."}},
  async revokeOtherSessions():Promise<SessionManagementResult<{message:string}>>{
    if(dataSourceService.getStatus().isMock)return{ok:true,data:{message:"No other mock sessions are active."}};const client=getSupabaseClient();if(!client)return{ok:false,message:"Session management is unavailable."};
    const authResult=await client.auth.signOut({scope:"others"});if(authResult.error)return{ok:false,message:"Picom could not revoke other Supabase Auth sessions."};const{data,error}=await client.rpc("revoke_other_device_sessions");if(error)return{ok:false,message:"Auth sessions were revoked, but device metadata refresh needs support review."};return{ok:true,data:{message:`Revoked ${data??0} other registered device session${data===1?"":"s"}. Existing access tokens may remain valid only until their short expiry.`}};
  },
  subscribeToCurrentSessionRevocation(userId:string,onRevoked:()=>void):()=>void{
    if(dataSourceService.getStatus().isMock)return()=>undefined;const client=getSupabaseClient();if(!client)return()=>undefined;const currentDevice=deviceId();const channel=client.channel(`device-session:${userId}:${currentDevice}`).on("postgres_changes",{event:"UPDATE",schema:"public",table:"user_device_sessions",filter:`user_id=eq.${userId}`},(payload)=>{const row=payload.new as{device_id?:string;revoked_at?:string|null};if(row.device_id===currentDevice&&row.revoked_at)onRevoked()}).subscribe();return()=>{void client.removeChannel(channel)};
  },
  subscribeToDeviceSessionChanges(userId:string,onChange:()=>void):()=>void{
    if(dataSourceService.getStatus().isMock)return()=>undefined;
    const client=getSupabaseClient();
    if(!client||!userId)return()=>undefined;
    const channel=client.channel(`device-sessions-list:${userId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"user_device_sessions",filter:`user_id=eq.${userId}`},()=>{onChange()})
      .subscribe();
    return()=>{void client.removeChannel(channel)};
  },
};
