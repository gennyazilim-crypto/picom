export const liveKitRoomPrefix = "community";

export function createPicomLiveKitRoomName(communityId: string, channelId: string): string {
  return `${liveKitRoomPrefix}:${communityId}:voice:${channelId}`;
}

export function matchesPicomLiveKitRoomName(roomName: string, communityId: string, channelId: string): boolean {
  return roomName === createPicomLiveKitRoomName(communityId, channelId);
}

export const liveKitDirectRoomPrefix = "direct";

export function createPicomDirectLiveKitRoomName(conversationId: string): string {
  return `${liveKitDirectRoomPrefix}:${conversationId}`;
}

export function matchesPicomDirectLiveKitRoomName(roomName: string, conversationId: string): boolean {
  return roomName === createPicomDirectLiveKitRoomName(conversationId);
}

export const liveKitDirectCallRoomPrefix = "direct-call";

export function createPicomDirectCallLiveKitRoomName(callId: string): string {
  return `${liveKitDirectCallRoomPrefix}:${callId}`;
}

export function matchesPicomDirectCallLiveKitRoomName(roomName: string, callId: string): boolean {
  return roomName === createPicomDirectCallLiveKitRoomName(callId);
}

export function createPicomMeetingLiveKitRoomName(roomId: string, sessionId: string): string {
  return `meeting:${roomId}:session:${sessionId}`;
}

export function matchesPicomMeetingLiveKitRoomName(roomName: string, roomId: string, sessionId: string): boolean {
  return roomName === createPicomMeetingLiveKitRoomName(roomId, sessionId);
}

export const liveKitPublisherStreamRoomPrefix = "publisher-stream";
export const publisherStreamRoomPattern = /^publisher-stream:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export function createPicomPublisherStreamLiveKitRoomName(streamId: string): string {
  return `${liveKitPublisherStreamRoomPrefix}:${streamId}`;
}

export function matchesPicomPublisherStreamLiveKitRoomName(roomName: string, streamId: string): boolean {
  return roomName === createPicomPublisherStreamLiveKitRoomName(streamId);
}

export function parsePublisherStreamIdFromLiveKitRoomName(roomName: string): string | null {
  const match = publisherStreamRoomPattern.exec(roomName);
  return match?.[1]?.toLowerCase() ?? null;
}
