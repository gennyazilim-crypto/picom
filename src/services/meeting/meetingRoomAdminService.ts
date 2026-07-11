import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import type { CommunityMeetingRoom, CommunityMeetingRoomDraft, MeetingRoomAdminResult, MeetingRoomArchivePolicy, MeetingWorkspaceDestination } from "../../types/meetingAdmin";

type RpcClient = Readonly<{ rpc: (name: string, args?: Record<string, unknown>) => Promise<Readonly<{ data: unknown; error: { message: string } | null }>> }>;
type RoomRow = Record<string, unknown>;
const mockRooms = new Map<string, CommunityMeetingRoom[]>();

const ok = <T>(data: T): MeetingRoomAdminResult<T> => ({ ok: true, data });
const fail = <T>(error: string): MeetingRoomAdminResult<T> => ({ ok: false, error });
const workspaceForMode = (mode: CommunityMeetingRoom["mode"]): MeetingWorkspaceDestination => mode === "voice" ? "voice_lounge" : mode === "stage" ? "stage" : "meeting";
const booleanValue = (value: unknown, fallback: boolean) => typeof value === "boolean" ? value : fallback;
const objectValue = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function mapRoom(row: RoomRow): CommunityMeetingRoom {
  const mode = row.mode === "voice" || row.mode === "stage" ? row.mode : "meeting";
  const capabilities = objectValue(row.capabilities);
  const moderation = objectValue(row.moderation_policy);
  return {
    id: String(row.id), communityId: String(row.community_id), channelId: typeof row.channel_id === "string" ? row.channel_id : null,
    linkedChatChannelId: typeof row.linked_chat_channel_id === "string" ? row.linked_chat_channel_id : null,
    title: String(row.title), description: String(row.description ?? ""), mode,
    status: ["scheduled","open","live","ended","cancelled","locked"].includes(String(row.status)) ? row.status as CommunityMeetingRoom["status"] : "open",
    joinPolicy: ["open","members","invite_only","approval_required"].includes(String(row.join_policy)) ? row.join_policy as CommunityMeetingRoom["joinPolicy"] : "members",
    capabilities: {
      canPublishAudio: booleanValue(capabilities.canPublishAudio,true), canPublishVideo: booleanValue(capabilities.canPublishVideo,mode!=="voice"),
      canShareScreen: booleanValue(capabilities.canShareScreen,mode!=="voice"), canSendChat: booleanValue(capabilities.canSendChat,true),
      canReact: booleanValue(capabilities.canReact,true), canRaiseHand: booleanValue(capabilities.canRaiseHand,true),
    },
    waitingRoomEnabled: booleanValue(row.waiting_room_enabled,false), audienceMode: booleanValue(row.audience_mode,mode==="stage"),
    maxParticipants: Number(row.max_participants ?? 50), moderationPolicy: {
      allowParticipantMute: booleanValue(moderation.allowParticipantMute,false), allowParticipantRemove: booleanValue(moderation.allowParticipantRemove,false),
      raiseHandRequired: booleanValue(moderation.raiseHandRequired,mode==="stage"),
    },
    position: Number(row.position ?? 0), activeSessionCount: Number(row.active_session_count ?? 0),
    workspace: row.workspace === "voice_lounge" || row.workspace === "stage" ? row.workspace : workspaceForMode(mode),
  };
}

function validateDraft(draft: CommunityMeetingRoomDraft): string | null {
  if (!draft.title.trim()) return "Room name is required.";
  if (draft.title.trim().length > 120 || draft.description.length > 2000) return "Room name or description is too long.";
  if (draft.maxParticipants < 2 || draft.maxParticipants > 1000) return "Participant limit must be between 2 and 1000.";
  if (draft.audienceMode && draft.mode !== "stage") return "Audience mode is available only for Stage rooms.";
  return null;
}

async function rpc(name: string, args: Record<string, unknown>): Promise<MeetingRoomAdminResult<unknown>> {
  const client = getSupabaseClient(); if (!client) return fail("Supabase meeting storage is unavailable.");
  const result = await (client as unknown as RpcClient).rpc(name,args);
  return result.error ? fail(result.error.message) : ok(result.data);
}

export const meetingRoomAdminService = {
  workspaceForMode,
  async list(communityId: string): Promise<MeetingRoomAdminResult<CommunityMeetingRoom[]>> {
    if (dataSourceService.getStatus().isMock) return ok([...(mockRooms.get(communityId) ?? [])].sort((a,b)=>a.position-b.position));
    const result=await rpc("list_community_meeting_rooms",{target_community_id:communityId});if(!result.ok)return result;
    return ok((Array.isArray(result.data)?result.data:[]).map((row)=>mapRoom(row as RoomRow)));
  },
  async create(communityId: string,draft: CommunityMeetingRoomDraft): Promise<MeetingRoomAdminResult<CommunityMeetingRoom>> {
    const invalid=validateDraft(draft);if(invalid)return fail(invalid);
    if(dataSourceService.getStatus().isMock){const current=mockRooms.get(communityId)??[];const now=Date.now();const room:CommunityMeetingRoom={id:`local-meeting-${now}`,communityId,channelId:`local-voice-channel-${now}`,linkedChatChannelId:draft.linkedChatChannelId,title:draft.title.trim(),description:draft.description.trim(),mode:draft.mode,status:"open",joinPolicy:draft.joinPolicy,capabilities:{...draft.capabilities,canPublishVideo:draft.mode==="voice"?false:draft.capabilities.canPublishVideo},waitingRoomEnabled:draft.waitingRoomEnabled||draft.joinPolicy==="approval_required",audienceMode:draft.mode==="stage"&&draft.audienceMode,maxParticipants:draft.maxParticipants,moderationPolicy:draft.moderationPolicy,position:current.length,activeSessionCount:0,workspace:workspaceForMode(draft.mode)};mockRooms.set(communityId,[...current,room]);return ok(room);}
    const result=await rpc("create_community_meeting_room",{target_community_id:communityId,target_category_id:draft.categoryId,room_name:draft.title,room_description:draft.description,room_mode:draft.mode,room_capabilities:draft.capabilities,room_waiting_enabled:draft.waitingRoomEnabled,room_audience_mode:draft.audienceMode,room_join_policy:draft.joinPolicy,room_participant_limit:draft.maxParticipants,room_chat_channel_id:draft.linkedChatChannelId,room_moderation_policy:draft.moderationPolicy});if(!result.ok)return result;return ok(mapRoom(result.data as RoomRow));
  },
  async update(room: CommunityMeetingRoom,draft: CommunityMeetingRoomDraft): Promise<MeetingRoomAdminResult<CommunityMeetingRoom>> {
    const invalid=validateDraft(draft);if(invalid)return fail(invalid);
    if(dataSourceService.getStatus().isMock){const updated:CommunityMeetingRoom={...room,title:draft.title.trim(),description:draft.description.trim(),mode:draft.mode,joinPolicy:draft.joinPolicy,capabilities:{...draft.capabilities,canPublishVideo:draft.mode==="voice"?false:draft.capabilities.canPublishVideo},waitingRoomEnabled:draft.waitingRoomEnabled||draft.joinPolicy==="approval_required",audienceMode:draft.mode==="stage"&&draft.audienceMode,maxParticipants:draft.maxParticipants,linkedChatChannelId:draft.linkedChatChannelId,moderationPolicy:draft.moderationPolicy,workspace:workspaceForMode(draft.mode)};mockRooms.set(room.communityId,(mockRooms.get(room.communityId)??[]).map((item)=>item.id===room.id?updated:item));return ok(updated);}
    const result=await rpc("update_community_meeting_room",{target_room_id:room.id,room_name:draft.title,room_description:draft.description,room_mode:draft.mode,room_capabilities:draft.capabilities,room_waiting_enabled:draft.waitingRoomEnabled,room_audience_mode:draft.audienceMode,room_join_policy:draft.joinPolicy,room_participant_limit:draft.maxParticipants,room_chat_channel_id:draft.linkedChatChannelId,room_moderation_policy:draft.moderationPolicy});if(!result.ok)return result;return ok(mapRoom(result.data as RoomRow));
  },
  async archive(room: CommunityMeetingRoom,confirmationTitle:string,policy:MeetingRoomArchivePolicy,replacementRoomId:string|null):Promise<MeetingRoomAdminResult<boolean>>{
    if(confirmationTitle.trim()!==room.title)return fail("Type the exact room name to confirm.");
    if(dataSourceService.getStatus().isMock){if(room.activeSessionCount>0&&policy==="deny")return fail("End or transfer the active session before removing this room.");mockRooms.set(room.communityId,(mockRooms.get(room.communityId)??[]).filter((item)=>item.id!==room.id).map((item,index)=>({...item,position:index})));return ok(true);}
    const result=await rpc("archive_community_meeting_room",{target_room_id:room.id,confirmation_title:confirmationTitle,active_policy:policy,replacement_room_id:replacementRoomId});return result.ok?ok(true):result;
  },
  async move(room:CommunityMeetingRoom,direction:"up"|"down"):Promise<MeetingRoomAdminResult<boolean>>{
    if(dataSourceService.getStatus().isMock){const ordered=[...(mockRooms.get(room.communityId)??[])].sort((a,b)=>a.position-b.position);const index=ordered.findIndex((item)=>item.id===room.id);const target=direction==="up"?index-1:index+1;if(index<0||target<0||target>=ordered.length)return ok(false);const [item]=ordered.splice(index,1);ordered.splice(target,0,item);mockRooms.set(room.communityId,ordered.map((entry,position)=>({...entry,position})));return ok(true);}
    const result=await rpc("move_community_meeting_room",{target_room_id:room.id,move_direction:direction});return result.ok?ok(Boolean(result.data)):result;
  },
};
