import type { MeetingClientJoinRequest, MeetingClientParticipant } from "../types/meetingClient";

const baseRequest: MeetingClientJoinRequest = {
  roomId:"meeting-room-mock-01",sessionId:"meeting-session-mock-01",communityId:"community-aurora",communityName:"Aurora Studio",channelId:"aurora-general",channelName:"general",roomTitle:"Design review",participantName:"Mock owner",requestedSources:{microphone:true,camera:false,screenShare:false,data:true},mockDisposition:"authorized",mockRole:"host",
};

const participants: readonly MeetingClientParticipant[] = [
  {id:"mock-participant-local",userId:"u-current",identity:"mock-local-participant",displayName:"Mock owner",role:"host",presence:"connected",isLocal:true,isSpeaking:false,microphoneEnabled:true,cameraEnabled:false,screenSharing:false,handRaised:false,connectionQuality:"excellent"},
  {id:"mock-participant-remote",userId:"u-mira",identity:"mock-remote-participant",displayName:"Mira Chen",role:"participant",presence:"connected",isLocal:false,isSpeaking:true,microphoneEnabled:true,cameraEnabled:false,screenSharing:false,handRaised:false,connectionQuality:"good"},
];

export const mockMeetingClientFixtures = Object.freeze({
  connected:{request:baseRequest,participants},
  waiting:{request:{...baseRequest,roomId:"meeting-room-wait-01",sessionId:"meeting-session-wait-01",mockDisposition:"waiting" as const,mockRole:"guest" as const},participants:[]},
  failed:{request:{...baseRequest,roomId:"meeting-room-fail-01",sessionId:"meeting-session-fail-01",mockDisposition:"failed" as const},participants:[]},
});
