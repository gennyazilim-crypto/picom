import type { Database, Json } from "../supabase/database.types";
import { getSupabaseClient } from "../supabase/supabaseClient";
import type { FeedMode, FeedQuery, FeedServiceErrorCode, FeedServiceResult } from "../../types/feed";

export type RankedFeedRow = Database["public"]["Functions"]["get_feed_page"]["Returns"][number];
export type FeedMetadataRow = Database["public"]["Functions"]["get_feed_item_metadata"]["Returns"][number];
export type FeedProfileRow = Readonly<{id:string;display_name:string;username:string;avatar_url:string|null}>;
export type FeedRepositoryPage = Readonly<{rows:readonly RankedFeedRow[];metadata:readonly FeedMetadataRow[];profiles:readonly FeedProfileRow[]}>;

function failure<T>(code:FeedServiceErrorCode,message:string,retryable=true):FeedServiceResult<T>{return {ok:false,error:{code,message,retryable}};}
function errorCode(error:{code?:string}|null):FeedServiceErrorCode{return error?.code==="42501"?"FEED_ACCESS_LOST":"FEED_REQUEST_FAILED";}

export const feedRepository = {
  async listPage(query:FeedQuery,requestLimit:number):Promise<FeedServiceResult<FeedRepositoryPage>>{
    const client=getSupabaseClient();
    if(!client)return failure("FEED_BACKEND_UNAVAILABLE","The Feed service is not configured.",false);
    const cursor=query.cursor;
    const page=await client.rpc("get_feed_page",{
      feed_tab:query.mode,cursor_group_priority:cursor?.groupPriority??null,cursor_final_score:cursor?.finalScore??null,
      cursor_created_at:cursor?.createdAt??null,cursor_feed_item_id:cursor?.feedItemId??null,as_of_input:cursor?.asOf??null,
      source_filters:query.sourceTypes?.length?[...query.sourceTypes]:null,unread_only:query.unreadOnly??false,saved_only:query.savedOnly??false,
      result_limit:requestLimit,community_scope:query.communityId??null,
    });
    if(page.error)return failure(errorCode(page.error),page.error.code==="42501"?"Feed access changed. Refresh to continue.":"Picom could not load the Feed.",page.error.code!=="42501");
    const rows=page.data??[];const ids=rows.map(row=>row.feed_item_id);
    if(!ids.length)return {ok:true,data:{rows:[],metadata:[],profiles:[]}};
    const metadataResult=await client.rpc("get_feed_item_metadata",{target_feed_item_ids:ids});
    if(metadataResult.error)return failure(errorCode(metadataResult.error),"Picom could not load Feed card details.");
    const metadata=metadataResult.data??[];
    const commenterIds=[...new Set(metadata.flatMap(row=>row.commenter_ids??[]))];
    const profilesResult=commenterIds.length
      ?await client.from("profiles").select("id,display_name,username,avatar_url").in("id",commenterIds)
      :{data:[] as FeedProfileRow[],error:null};
    if(profilesResult.error)return failure("FEED_REQUEST_FAILED","Picom could not load Feed participant summaries.");
    return {ok:true,data:{rows,metadata,profiles:(profilesResult.data??[]) as FeedProfileRow[]}};
  },
  async setUserState(feedItemId:string,action:"read"|"save"|"unsave"|"hide"|"seen"|"opened"):Promise<FeedServiceResult<Json>>{
    const client=getSupabaseClient();if(!client)return failure("FEED_BACKEND_UNAVAILABLE","The Feed service is not configured.",false);
    const result=await client.rpc("set_feed_user_state_v1",{target_feed_item_id:feedItemId,target_action:action});
    return result.error?failure(errorCode(result.error),result.error.code==="42501"?"This Feed item is no longer available.":"Picom could not update this Feed item.",result.error.code!=="42501"):{ok:true,data:result.data};
  },
  async recordImpressions(sessionId:string,itemIds:readonly string[],mode:FeedMode,asOf:string):Promise<FeedServiceResult<number>>{
    const client=getSupabaseClient();if(!client)return failure("FEED_BACKEND_UNAVAILABLE","The Feed service is not configured.",false);
    if(!itemIds.length)return {ok:true,data:0};
    const result=await client.rpc("record_feed_impressions_v1",{target_session_id:sessionId,target_feed_item_ids:[...itemIds],target_positions:itemIds.map((_,index)=>index),target_feed_mode:mode,target_as_of:asOf});
    return result.error?failure(errorCode(result.error),"Picom could not record Feed visibility."):{ok:true,data:Number(result.data)||0};
  },
};

