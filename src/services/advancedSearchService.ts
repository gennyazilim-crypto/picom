import type { Community } from "../types/community";
import type { MentionItem } from "../types/mentions";
import { canViewChannel, getCommunityAccess } from "./permissions/communityPermissions";
import { getSupabaseClient } from "./supabase/supabaseClient";

export type AdvancedSearchCategory = "People" | "Communities" | "Channels" | "Messages" | "Mentions" | "Media";
export type AdvancedSearchResult = Readonly<{
  id: string; category: AdvancedSearchCategory; label: string; detail: string;
  communityId?: string; channelId?: string; messageId?: string; userId?: string; attachmentId?: string;
}>;

function includes(value: string | null | undefined, query: string) { return Boolean(value?.toLocaleLowerCase().includes(query)); }
function safeQuery(query: string) { return query.trim().replace(/[%_]/g, "").slice(0, 80); }

export function searchLocal(queryInput: string, communities: Community[], mentions: MentionItem[], currentUserId: string): AdvancedSearchResult[] {
  const query = queryInput.trim().toLocaleLowerCase();
  const results: AdvancedSearchResult[] = [];
  const seenUsers = new Set<string>();
  for (const community of communities) {
    const access = getCommunityAccess(currentUserId, community);
    if (!access.isMember && !access.canViewPublicContent) continue;
    if (!query || includes(community.name,query) || includes(community.description,query)) results.push({id:`search-community-${community.id}`,category:"Communities",label:community.name,detail:access.isVisitor?"Public community":"Community",communityId:community.id});
    const visibleChannels=community.categories.flatMap((category)=>category.channels).filter((channel)=>canViewChannel(access,channel));
    const visibleIds=new Set(visibleChannels.map((channel)=>channel.id));
    for(const channel of visibleChannels) if(!query||includes(channel.name,query)||includes(channel.topic,query)) results.push({id:`search-channel-${channel.id}`,category:"Channels",label:`#${channel.name}`,detail:community.name,communityId:community.id,channelId:channel.id});
    if(access.canViewMemberList) for(const member of community.members) if(!seenUsers.has(member.userId)&&(!query||includes(member.displayName,query)||includes(member.username,query))){seenUsers.add(member.userId);results.push({id:`search-person-${member.userId}`,category:"People",label:member.displayName,detail:`@${member.username}`,userId:member.userId,communityId:community.id});}
    for(const message of community.messages) {
      if(!visibleIds.has(message.channelId)) continue;
      if(!query||includes(message.body,query)) results.push({id:`search-message-${message.id}`,category:"Messages",label:message.body.slice(0,72)||"Message",detail:community.name,communityId:community.id,channelId:message.channelId,messageId:message.id});
      for(const attachment of message.attachments??[]) if(!query||includes(attachment.alt,query)) results.push({id:`search-media-${attachment.id}`,category:"Media",label:attachment.alt??"Shared image",detail:community.name,communityId:community.id,channelId:message.channelId,messageId:message.id,attachmentId:attachment.id});
    }
  }
  for(const mention of mentions){const community=communities.find((item)=>item.id===mention.communityId);if(!community)continue;const access=getCommunityAccess(currentUserId,community);const channel=community.categories.flatMap((category)=>category.channels).find((item)=>item.id===mention.channelId);if(!channel||!canViewChannel(access,channel))continue;if(!query||includes(mention.body,query)||includes(mention.title,query))results.push({id:`search-mention-${mention.id}`,category:"Mentions",label:mention.title??mention.body.slice(0,72),detail:community.name,communityId:community.id,channelId:mention.channelId,messageId:mention.messageId});}
  return results.slice(0,80);
}

export async function searchMessages(queryInput:string):Promise<AdvancedSearchResult[]>{const query=safeQuery(queryInput);const client=getSupabaseClient();if(!client||!query)return[];const {data}=await client.from("messages").select("id,community_id,channel_id,body").ilike("body",`%${query}%`).is("deleted_at",null).limit(30);return(data??[]).map((row)=>({id:`remote-message-${row.id}`,category:"Messages",label:row.body.slice(0,72),detail:"Accessible message",communityId:row.community_id,channelId:row.channel_id,messageId:row.id}));}
export async function searchPeople(queryInput:string):Promise<AdvancedSearchResult[]>{const query=safeQuery(queryInput);const client=getSupabaseClient();if(!client||!query)return[];const {data}=await client.from("profiles").select("id,display_name,username").or(`display_name.ilike.%${query}%,username.ilike.%${query}%`).limit(20);return(data??[]).map((row)=>({id:`remote-person-${row.id}`,category:"People",label:row.display_name,detail:`@${row.username}`,userId:row.id}));}
export async function searchChannels(queryInput:string):Promise<AdvancedSearchResult[]>{const query=safeQuery(queryInput);const client=getSupabaseClient();if(!client||!query)return[];const {data}=await client.from("channels").select("id,community_id,name").ilike("name",`%${query}%`).limit(20);return(data??[]).map((row)=>({id:`remote-channel-${row.id}`,category:"Channels",label:`#${row.name}`,detail:"Accessible channel",communityId:row.community_id,channelId:row.id}));}
export async function searchMentions(queryInput:string):Promise<AdvancedSearchResult[]>{const messages=await searchMessages(queryInput);return messages.filter((item)=>item.label.includes("@")).map((item)=>({...item,id:item.id.replace("remote-message","remote-mention"),category:"Mentions" as const}));}
export const advancedSearchService={searchLocal,searchMessages,searchPeople,searchChannels,searchMentions};

