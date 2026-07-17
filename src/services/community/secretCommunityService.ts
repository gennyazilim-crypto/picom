import type { CommunityKind, Member } from "../../types/community";
import type { CommunityInvitePreview, InviteAcceptanceStatus } from "./communityInviteService";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { mapCommunityListRow } from "../communityListQuery";

export type SecretCommunityEligibility = Readonly<{
  eligible:boolean; phoneVerified:boolean; voiceCallVerified:boolean; accountSuspended:boolean;
  creationRestricted:boolean; phoneLast4:string|null; reason:string|null;
}>;
export type SecretCommunityInvite = Readonly<{
  id:string; communityId:string; recipientUserId:string; recipientUsername:string;
  code:string; expiresAt:string; maxUses:number; uses:number; createdAt:string;
}>;
export type SecretInviteCampaign = Readonly<{
  id:string; recipientUserId:string; recipientUsername:string; recipientName:string; expiresAt:string;
  maxUses:number; uses:number; acceptedAt:string|null; revokedAt:string|null; leftAt:string|null; createdAt:string;
}>;
export type SecretInviteRule = Readonly<{ id:string; title:string; body:string; required:boolean; position:number }>;
export type SecretCommunityInvitePreview = CommunityInvitePreview & Readonly<{
  visibility:"secret"; warningVersion:string; rulesVersion:string; rulesEnabled:true;
  rules:readonly SecretInviteRule[]; warnings:readonly string[];
  verification:Readonly<{phoneVerified:boolean;voiceCallVerified:boolean;accountSuspended:boolean;accountRestricted:boolean}>;
}>;
type Result<T> = Readonly<{ok:true;data:T}>|Readonly<{ok:false;error:Readonly<{code:string;message:string}>}>;

const messages:Record<string,string>={
  AUTH_REQUIRED:"Sign in to continue.",
  PHONE_VERIFICATION_REQUIRED:"Verify a unique phone number by voice call before continuing.",
  VOICE_CALL_VERIFICATION_REQUIRED:"Complete the voice-call verification before continuing.",
  PHONE_ALREADY_IN_USE:"This phone number is already verified for another Picom account.",
  ACCOUNT_SUSPENDED:"This account is suspended and cannot use secret communities.",
  ACCOUNT_RESTRICTED:"This account is restricted from joining secret communities.",
  COMMUNITY_CREATION_RESTRICTED:"This account is restricted from creating communities.",
  SECRET_INVITE_INVALID:"This private invitation is invalid or unavailable for this account.",
  SECRET_INVITE_EXPIRED:"This private invitation expired. Ask an authorized member for a new invitation.",
  SECRET_WARNING_ACCEPTANCE_REQUIRED:"Accept every security warning before joining.",
  COMMUNITY_RULES_ACCEPTANCE_REQUIRED:"Accept the current community rules before joining.",
  SECRET_INVITE_RECIPIENT_NOT_FOUND:"No Picom account matches that username.",
  SECRET_INVITE_RECIPIENT_ALREADY_MEMBER:"That account is already a member.",
  SECRET_INVITE_FORBIDDEN:"Your role cannot create secret-community invitations.",
  VOICE_VERIFICATION_NOT_CONFIGURED:"Voice-call verification is not configured on this Picom environment.",
};
const fail=<T>(code:string,fallback:string):Result<T>=>({ok:false,error:{code,message:messages[code]??fallback}});
const errorCode=(error:{message?:string;code?:string}|null|undefined,fallback:string)=>{
  const value=error?.message??"";
  return Object.keys(messages).find((code)=>value.includes(code))??error?.code??fallback;
};

export const secretCommunityService={
  async getEligibility():Promise<Result<SecretCommunityEligibility>>{
    if(dataSourceService.getStatus().isMock)return fail("SECRET_COMMUNITY_REQUIRES_SUPABASE","Secret communities require the production Supabase security boundary.");
    const client=getSupabaseClient();if(!client)return fail("BACKEND_UNAVAILABLE","Picom could not reach account verification.");
    const {data,error}=await client.rpc("get_secret_community_creation_eligibility" as never,{} as never) as unknown as {data:Array<Record<string,unknown>>|null;error:{message:string;code?:string}|null};
    if(error||!data?.[0])return fail(errorCode(error,"ELIGIBILITY_LOAD_FAILED"),"Picom could not load secret-community eligibility.");
    const row=data[0];
    return {ok:true,data:{eligible:row.eligible===true,phoneVerified:row.phone_verified===true,
      voiceCallVerified:row.voice_call_verified===true,accountSuspended:row.account_suspended===true,
      creationRestricted:row.creation_restricted===true,phoneLast4:typeof row.phone_last4==="string"?row.phone_last4:null,
      reason:typeof row.reason==="string"?row.reason:null}};
  },
  async startVoiceVerification(phone:string):Promise<Result<true>>{
    const client=getSupabaseClient();
    if(!client||dataSourceService.getStatus().isMock)return fail("VOICE_VERIFICATION_NOT_CONFIGURED",messages.VOICE_VERIFICATION_NOT_CONFIGURED);
    const {data,error}=await client.functions.invoke("secret-community-verification",{body:{action:"start",phone}});
    const payload=data as {error?:{code?:string;message?:string}}|null;
    if(error||payload?.error)return fail(payload?.error?.code??"VOICE_VERIFICATION_START_FAILED",payload?.error?.message??"Picom could not start the verification call.");
    return {ok:true,data:true};
  },
  async checkVoiceVerification(phone:string,code:string):Promise<Result<true>>{
    const client=getSupabaseClient();
    if(!client||dataSourceService.getStatus().isMock)return fail("VOICE_VERIFICATION_NOT_CONFIGURED",messages.VOICE_VERIFICATION_NOT_CONFIGURED);
    const {data,error}=await client.functions.invoke("secret-community-verification",{body:{action:"check",phone,code}});
    const payload=data as {error?:{code?:string;message?:string}}|null;
    if(error||payload?.error)return fail(payload?.error?.code??"VOICE_VERIFICATION_CHECK_FAILED",payload?.error?.message??"Picom could not verify that code.");
    return {ok:true,data:true};
  },
  async createCommunity(input:{creationRequestId:string;kind:CommunityKind;name:string;description?:string;iconUrl?:string;accentColor?:string;templateId?:string}):Promise<Result<ReturnType<typeof mapCommunityListRow>>>{
    if(dataSourceService.getStatus().isMock)return fail("SECRET_COMMUNITY_REQUIRES_SUPABASE","Secret communities cannot be simulated in mock mode.");
    const client=getSupabaseClient();if(!client)return fail("BACKEND_UNAVAILABLE","Picom could not reach the community service.");
    const {data,error}=await client.rpc("create_secret_community" as never,{
      target_creation_request_id:input.creationRequestId,target_kind:input.kind,community_name:input.name,
      community_description:input.description??null,community_icon_url:input.iconUrl??null,
      community_accent_color:input.accentColor??"#169c91",community_template_id:input.templateId??"custom",
    } as never) as unknown as {data:Array<Record<string,unknown>>|null;error:{message:string;code?:string}|null};
    if(error||!data?.[0])return fail(errorCode(error,"SECRET_COMMUNITY_CREATE_FAILED"),"Picom could not create the secret community.");
    return {ok:true,data:mapCommunityListRow(data[0] as never)};
  },
  async createInvite(communityId:string,recipientUsername:string):Promise<Result<SecretCommunityInvite>>{
    const client=getSupabaseClient();
    if(!client||dataSourceService.getStatus().isMock)return fail("SECRET_INVITE_BACKEND_REQUIRED","Secret invitations require Supabase.");
    const {data,error}=await client.rpc("create_secret_community_invite" as never,{target_community_id:communityId,recipient_username:recipientUsername.trim()} as never) as unknown as {data:SecretCommunityInvite|null;error:{message:string;code?:string}|null};
    if(error||!data)return fail(errorCode(error,"SECRET_INVITE_CREATE_FAILED"),"Picom could not create this private invitation.");
    return {ok:true,data};
  },
  async listInvites(communityId:string):Promise<Result<readonly SecretInviteCampaign[]>>{
    const client=getSupabaseClient();
    if(!client||dataSourceService.getStatus().isMock)return fail("SECRET_INVITE_BACKEND_REQUIRED","Secret invitations require Supabase.");
    const {data,error}=await client.rpc("list_secret_community_invites" as never,{target_community_id:communityId} as never) as unknown as {data:SecretInviteCampaign[]|null;error:{message:string;code?:string}|null};
    return error?fail(errorCode(error,"SECRET_INVITE_LIST_FAILED"),"Picom could not load private invitations."):{ok:true,data:data??[]};
  },
  async revokeInvite(inviteId:string):Promise<Result<true>>{
    const client=getSupabaseClient();
    if(!client||dataSourceService.getStatus().isMock)return fail("SECRET_INVITE_BACKEND_REQUIRED","Secret invitations require Supabase.");
    const {data,error}=await client.rpc("revoke_secret_community_invite" as never,{target_invite_id:inviteId} as never);
    return error||data!==true?fail(errorCode(error,"SECRET_INVITE_REVOKE_FAILED"),"Picom could not revoke this invitation."):{ok:true,data:true};
  },
  async previewInvite(value:string):Promise<Result<SecretCommunityInvitePreview>>{
    const client=getSupabaseClient();
    if(!client||dataSourceService.getStatus().isMock)return fail("SECRET_INVITE_BACKEND_REQUIRED","Secret invitations require Supabase.");
    const {data,error}=await client.rpc("preview_secret_community_invite" as never,{raw_credential:this.extractCode(value)} as never) as unknown as {data:(SecretCommunityInvitePreview&{ok?:boolean;code?:string})|null;error:{message:string;code?:string}|null};
    if(error||!data||data.ok===false)return fail(data?.code??errorCode(error,"SECRET_INVITE_INVALID"),"This private invitation is unavailable.");
    return {ok:true,data};
  },
  async acceptInvite(input:{code:string;warningVersion:string;rulesVersion:string;warningsAccepted:boolean;rulesAccepted:boolean;currentUser:Member}):Promise<Result<{communityId:string;member:Member;status:InviteAcceptanceStatus}>>{
    const client=getSupabaseClient();
    if(!client||dataSourceService.getStatus().isMock)return fail("SECRET_INVITE_BACKEND_REQUIRED","Secret invitations require Supabase.");
    const {data,error}=await client.rpc("accept_secret_community_invite" as never,{
      raw_credential:this.extractCode(input.code),accepted_warning_version:input.warningVersion,
      accepted_rules_version:input.rulesVersion,accepted_warnings:input.warningsAccepted,accepted_rules:input.rulesAccepted,
    } as never) as unknown as {data:{ok?:boolean;code?:string;status?:InviteAcceptanceStatus;communityId?:string}|null;error:{message:string;code?:string}|null};
    if(error||!data||data.ok===false||!data.communityId)return fail(data?.code??errorCode(error,"SECRET_INVITE_ACCEPT_FAILED"),"Picom could not accept this private invitation.");
    return {ok:true,data:{communityId:data.communityId,member:{...input.currentUser},status:data.status??"joined"}};
  },
  extractCode(value:string){
    const trimmed=value.trim();
    const match=trimmed.match(/(?:picom:\/\/invite\/|https?:\/\/[^/]+\/invite\/)([a-fA-F0-9]{64}|[0-9a-fA-F]{8}-[0-9a-fA-F-]{27})/);
    return (match?.[1]??trimmed).toLowerCase();
  },
  getInviteLink(code:string){return "picom://invite/"+code;},
};
