import type { CreateReportInput } from "../../types/reports";
import type { Attachment } from "../../types/community";
import type { MeetingChatContext, MeetingChatDeepLinkInput, MeetingChatSendInput } from "../../types/meetingChat";
import type { MeetingClientContext } from "../../types/meetingClient";
import { currentUserId } from "../../data/mockCommunities";
import { attachmentService, type AttachmentMetadataSummary } from "../attachmentService";
import { dataSourceService } from "../dataSourceService";
import { deepLinkService } from "../deepLinkService";
import { messageService, type DeleteMessageInput, type EditMessageInput, type MessageServiceResult, type MessageSummary } from "../messageService";
import type { MessagePage } from "../messageListQuery";
import { reactionService, type ReactionMutationInput } from "../reactionService";
import { reportService } from "../reportService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { subscribeToChannelMessages, type RealtimeConnectionStatus } from "../supabase/realtimeService";
import { uploadService } from "../uploadService";

type ContextResult<T> = Readonly<{ ok: true; data: T } | { ok: false; error: Readonly<{ code: string; message: string }> }>;
export type MeetingChatMessage = MessageSummary & Readonly<{
  attachments: readonly Attachment[];
  replyPreview: Readonly<{ id: string; authorId: string; body: string; deleted: boolean }> | null;
}>;
export type MeetingChatPage = Omit<MessagePage, "items"> & Readonly<{ items: readonly MeetingChatMessage[] }>;
const mockContexts = new Map<string, MeetingChatContext>();
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown): string => typeof value === "string" ? value : "";
const nullableText = (value: unknown): string | null => typeof value === "string" ? value : null;
const contextKey = (roomId: string, sessionId?: string | null) => `${roomId}:${sessionId ?? "room"}`;
const fail = <T>(code: string, message: string): ContextResult<T> => ({ ok: false, error: { code, message } });

function chatAttachment(item: AttachmentMetadataSummary): Attachment {
  return {
    id: item.id,
    type: "image",
    url: item.publicUrl ?? item.thumbnailUrl ?? "",
    publicUrl: item.publicUrl,
    thumbnailUrl: item.thumbnailUrl,
    storagePath: item.storagePath,
    mimeType: item.mimeType,
    alt: item.fileName || "Meeting chat image",
    width: item.width ?? undefined,
    height: item.height ?? undefined,
    blurhashPlaceholder: item.blurhashPlaceholder,
    scanStatus: item.scanStatus,
  };
}

export function mapMeetingChatContext(value: unknown): MeetingChatContext | null {
  const row=record(value);if(!row)return null;const contextKind=text(row.contextKind) as MeetingChatContext["contextKind"];
  const roomId=text(row.roomId),communityId=text(row.communityId),channelId=text(row.channelId);
  if(!roomId||!communityId||!channelId||!["linked_channel","dedicated_thread","meeting_source"].includes(contextKind))return null;
  return {roomId,sessionId:nullableText(row.sessionId),communityId,channelId,threadId:nullableText(row.threadId),contextKind,title:text(row.title)||"Meeting chat",preserveAfterMeeting:row.preserveAfterMeeting===true,guestAccessExpiresAt:nullableText(row.guestAccessExpiresAt),canRead:row.canRead===true,canWrite:row.canWrite===true,isGuest:row.isGuest===true};
}

export function createMeetingChatDeepLink(input:MeetingChatDeepLinkInput):string {
  const community=encodeURIComponent(input.communityId),channel=encodeURIComponent(input.channelId),room=encodeURIComponent(input.roomId);const session=input.sessionId?`/session/${encodeURIComponent(input.sessionId)}`:"";const message=input.messageId?`/message/${encodeURIComponent(input.messageId)}`:"";
  return `picom://meeting/${community}/channel/${channel}/room/${room}${session}/chat${message}`;
}

async function resolve(roomId:string,sessionId?:string|null):Promise<ContextResult<MeetingChatContext>> {
  if(!roomId.trim())return fail("MEETING_CHAT_CONTEXT_INVALID","Choose a valid meeting room.");
  if(dataSourceService.getStatus().isMock){const context=mockContexts.get(contextKey(roomId,sessionId))??mockContexts.get(contextKey(roomId));return context?{ok:true,data:{...context,sessionId:sessionId??context.sessionId}}:fail("MEETING_CHAT_CONTEXT_MISSING","This mock meeting has no linked chat context.");}
  const client=getSupabaseClient();if(!client)return fail("DATA_SOURCE_NOT_CONFIGURED","Supabase is not configured.");
  const {data,error}=await client.rpc("get_meeting_chat_context",{target_room_id:roomId,target_session_id:sessionId??null});const context=mapMeetingChatContext(data);
  return error||!context?fail("MEETING_CHAT_ACCESS_FAILED","Picom could not open this meeting chat."):{ok:true,data:context};
}

export const meetingChatContextService={
  resolve,
  async resolveForMeeting(context:MeetingClientContext):Promise<ContextResult<MeetingChatContext>>{
    if(dataSourceService.getStatus().isMock&&!mockContexts.has(contextKey(context.roomId,context.sessionId))){this.seedMock({roomId:context.roomId,sessionId:context.sessionId,communityId:context.communityId,channelId:context.channelId,threadId:null,contextKind:"linked_channel",title:`${context.roomTitle} chat`,preserveAfterMeeting:true,guestAccessExpiresAt:null,canRead:true,canWrite:true,isGuest:false});}
    return resolve(context.roomId,context.sessionId);
  },
  seedMock(context:MeetingChatContext):void{mockContexts.set(contextKey(context.roomId,context.sessionId),context);mockContexts.set(contextKey(context.roomId),context)},
  async listMessages(context:MeetingChatContext,options:{limit?:number;before?:string|null}={}):Promise<ContextResult<MeetingChatPage>>{
    const page=await messageService.listMessages({communityId:context.communityId,channelId:context.channelId,threadId:context.threadId,limit:options.limit,before:options.before});
    if(!page.ok)return page;
    const attachments=await attachmentService.listForMessages(page.data.items.map((message)=>message.id));
    if(!attachments.ok)return fail(attachments.error.code,attachments.error.message);
    const byMessage=new Map<string,Attachment[]>();
    for(const item of attachments.data){if(!item.messageId)continue;const list=byMessage.get(item.messageId)??[];list.push(chatAttachment(item));byMessage.set(item.messageId,list)}
    const byId=new Map(page.data.items.map((message)=>[message.id,message]));
    const items=page.data.items.map((message):MeetingChatMessage=>{const reply=message.replyToMessageId?byId.get(message.replyToMessageId):null;return{...message,attachments:byMessage.get(message.id)??[],replyPreview:message.replyToMessageId?{id:message.replyToMessageId,authorId:reply?.authorId??"",body:reply?.body??"Original message is outside the loaded history.",deleted:Boolean(reply?.deletedAt)||!reply}:null}});
    return{ok:true,data:{...page.data,items}};
  },
  async sendMessage(input:MeetingChatSendInput):Promise<MessageServiceResult<MessageSummary>>{
    if(!input.context.canWrite)return Promise.resolve({ok:false,error:{code:"MESSAGE_SEND_FAILED",message:"You no longer have permission to send messages in this meeting."}});
    const result=await messageService.sendMessage({communityId:input.context.communityId,channelId:input.context.channelId,threadId:input.context.threadId,meetingRoomId:input.context.roomId,meetingSessionId:input.context.sessionId,body:input.body,clientMessageId:input.clientMessageId,replyToMessageId:input.replyToMessageId,attachmentIds:input.attachmentIds});
    if(result.ok&&input.attachmentIds?.length)attachmentService.attachMockToMessage(result.data.id,input.attachmentIds);
    return result;
  },
  async uploadAttachments(context:MeetingChatContext,files:readonly File[],signal?:AbortSignal):Promise<ContextResult<AttachmentMetadataSummary[]>>{
    if(!context.canWrite)return fail("MEETING_CHAT_READ_ONLY","Join with chat permission before uploading attachments.");
    if(!files.length||files.length>4)return fail("MEETING_CHAT_ATTACHMENT_LIMIT","Choose between one and four images.");
    const created:AttachmentMetadataSummary[]=[];const uploadedPaths:string[]=[];
    for(const file of files){const upload=await uploadService.uploadImageAttachment({communityId:context.communityId,channelId:context.channelId,file,signal});if(!upload.ok){await Promise.all(uploadedPaths.map((storagePath)=>uploadService.removePending(storagePath)));return fail(upload.error.code,upload.error.message)}uploadedPaths.push(upload.data.storagePath);const metadata=await attachmentService.createPendingAttachmentMetadata({upload:upload.data});if(!metadata.ok){await Promise.all(uploadedPaths.map((storagePath)=>uploadService.removePending(storagePath)));return fail(metadata.error.code,metadata.error.message)}created.push(metadata.data)}
    return{ok:true,data:created};
  },
  editMessage(input:EditMessageInput){return messageService.editMessage(input)},
  deleteMessage(input:DeleteMessageInput){return messageService.deleteMessage(input)},
  addReaction(input:ReactionMutationInput){return reactionService.addReaction(input)},
  removeReaction(input:ReactionMutationInput){return reactionService.removeReaction(input)},
  reportMessage(context:MeetingChatContext,input:Omit<CreateReportInput,"communityId"|"channelId"|"targetType">){return reportService.submitReport({...input,communityId:context.communityId,channelId:context.channelId,targetType:"message"})},
  async getActorId():Promise<string|null>{if(dataSourceService.getStatus().isMock)return currentUserId;const client=getSupabaseClient();if(!client)return null;const{data}=await client.auth.getUser();return data.user?.id??null},
  async markRead(context:MeetingChatContext,lastReadMessageId:string|null):Promise<ContextResult<boolean>>{
    if(dataSourceService.getStatus().isMock)return{ok:true,data:true};const client=getSupabaseClient();if(!client)return fail("DATA_SOURCE_NOT_CONFIGURED","Supabase is not configured.");
    const {data,error}=await client.rpc("mark_meeting_chat_read",{target_room_id:context.roomId,target_session_id:context.sessionId,target_last_read_message_id:lastReadMessageId});return error?fail("MEETING_CHAT_READ_STATE_FAILED","Picom could not save the meeting chat read state."):{ok:true,data:data===true};
  },
  createDeepLink:createMeetingChatDeepLink,
  openDeepLink(input:MeetingChatDeepLinkInput):ContextResult<boolean>{const result=deepLinkService.handleDeepLink(createMeetingChatDeepLink(input));return result.ok?{ok:true,data:true}:fail("MEETING_CHAT_DEEP_LINK_FAILED","Picom could not open the linked meeting message.")},
  subscribeMessages(context:MeetingChatContext,onChange:()=>void,onStatus?:(status:RealtimeConnectionStatus)=>void):()=>void{
    if(dataSourceService.getStatus().isMock){onStatus?.("connected");return()=>undefined;}
    return subscribeToChannelMessages({communityId:context.communityId,channelId:context.channelId,onInsert:onChange,onUpdate:onChange,onDelete:onChange,onStatusChange:onStatus});
  },
  async copyDeepLink(input:MeetingChatDeepLinkInput):Promise<ContextResult<boolean>>{
    try{await navigator.clipboard.writeText(createMeetingChatDeepLink(input));return{ok:true,data:true};}catch{return fail("MEETING_LINK_COPY_FAILED","Picom could not copy the meeting link.");}
  },
};
