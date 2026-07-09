import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const STORAGE_KEY="picom.savedMessages.v2";
export type SavedMessageRecord=Readonly<{id:string;messageId:string;communityId?:string;channelId?:string;authorId?:string;preview?:string;messageCreatedAt?:string;createdAt:string}>;
function read():SavedMessageRecord[]{try{const raw=window.localStorage.getItem(STORAGE_KEY);return raw?JSON.parse(raw) as SavedMessageRecord[]:[];}catch{return[];}}
function write(items:SavedMessageRecord[]){try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(items));}catch{/* safe fallback */}}
export type SaveMessageContext=Readonly<{communityId:string;channelId:string;authorId:string;preview:string;messageCreatedAt:string}>;

export async function saveMessage(messageId:string,context?:SaveMessageContext):Promise<boolean>{
  if(!messageId.trim())return false;
  if(dataSourceService.getStatus().isMock){const items=read();if(!items.some((item)=>item.messageId===messageId))write([{id:`saved-${messageId}`,messageId,...context,createdAt:new Date().toISOString()},...items]);return true;}
  const client=getSupabaseClient();if(!client)return false;const {data}=await client.auth.getUser();if(!data.user)return false;
  const {error}=await client.from("saved_messages").upsert({user_id:data.user.id,message_id:messageId},{onConflict:"user_id,message_id"});return !error;
}
export async function unsaveMessage(messageId:string):Promise<boolean>{
  if(dataSourceService.getStatus().isMock){write(read().filter((item)=>item.messageId!==messageId));return true;}
  const client=getSupabaseClient();if(!client)return false;const {data}=await client.auth.getUser();if(!data.user)return false;
  const {error}=await client.from("saved_messages").delete().eq("user_id",data.user.id).eq("message_id",messageId);return !error;
}
export async function getSavedMessages():Promise<SavedMessageRecord[]>{
  if(dataSourceService.getStatus().isMock)return listSavedMessages();
  const client=getSupabaseClient();if(!client)return[];const {data}=await client.from("saved_messages").select("id,message_id,created_at").order("created_at",{ascending:false});return(data??[]).map((row)=>({id:row.id,messageId:row.message_id,createdAt:row.created_at}));
}
export function listSavedMessages():SavedMessageRecord[]{return read().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
export function isMessageSaved(messageId:string):boolean{return read().some((item)=>item.messageId===messageId);}
export const savedMessageService={saveMessage,unsaveMessage,getSavedMessages,listSavedMessages,isMessageSaved};
