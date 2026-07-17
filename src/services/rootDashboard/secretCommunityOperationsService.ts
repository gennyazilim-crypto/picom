import { getSupabaseClient } from "../supabase/supabaseClient";

export type RootSecretCommunitySummary=Readonly<{id:string;name:string;kind:string;ownerId:string;ownerName:string;memberCount:number;activeInviteCount:number;trustScore:number;riskLevel:string;incidentCount:number;recommendation:string;createdAt:string}>;
export type RootSecretCommunityDetail=Readonly<{community:Record<string,unknown>;trust:Record<string,unknown>;history:readonly Record<string,unknown>[];events:readonly Record<string,unknown>[];invites:readonly Record<string,unknown>[]}>;
type Result<T>={ok:true;data:T}|{ok:false;message:string};
export const secretCommunityOperationsService={
  async list():Promise<Result<readonly RootSecretCommunitySummary[]>>{
    const client=getSupabaseClient();if(!client)return {ok:false,message:"Root operations are unavailable."};
    const {data,error}=await client.rpc("list_root_secret_communities" as never,{result_limit:200} as never) as unknown as {data:RootSecretCommunitySummary[]|null;error:{message:string}|null};
    return error?{ok:false,message:"Picom could not load secret-community operations."}:{ok:true,data:data??[]};
  },
  async detail(communityId:string):Promise<Result<RootSecretCommunityDetail>>{
    const client=getSupabaseClient();if(!client)return {ok:false,message:"Root operations are unavailable."};
    const {data,error}=await client.rpc("get_root_secret_community_detail" as never,{target_community_id:communityId} as never) as unknown as {data:RootSecretCommunityDetail|null;error:{message:string}|null};
    return error||!data?{ok:false,message:"Picom could not load this security timeline."}:{ok:true,data};
  },
  async adjustTrust(communityId:string,delta:number,reason:string):Promise<Result<Record<string,unknown>>>{
    const client=getSupabaseClient();if(!client)return {ok:false,message:"Root operations are unavailable."};
    const {data,error}=await client.rpc("adjust_root_secret_community_trust_score" as never,{target_community_id:communityId,score_delta:delta,adjustment_reason:reason} as never) as unknown as {data:Record<string,unknown>|null;error:{message:string}|null};
    return error||!data?{ok:false,message:"The trust adjustment was rejected."}:{ok:true,data};
  },
  subscribe(onChange:()=>void){
    const client=getSupabaseClient();if(!client)return ()=>undefined;
    const channel=client.channel("root-secret-community-operations")
      .on("postgres_changes",{event:"*",schema:"public",table:"secret_community_security_events"},onChange)
      .on("postgres_changes",{event:"*",schema:"public",table:"secret_community_trust_profiles"},onChange)
      .on("postgres_changes",{event:"*",schema:"public",table:"secret_community_invites"},onChange).subscribe();
    return ()=>{void client.removeChannel(channel);};
  },
};
