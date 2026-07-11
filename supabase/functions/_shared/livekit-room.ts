export const liveKitRoomPrefix = "community";

export function createPicomLiveKitRoomName(communityId: string, channelId: string): string {
  return `${liveKitRoomPrefix}:${communityId}:voice:${channelId}`;
}

export function matchesPicomLiveKitRoomName(roomName: string, communityId: string, channelId: string): boolean {
  return roomName === createPicomLiveKitRoomName(communityId, channelId);
}

export function createPicomMeetingLiveKitRoomName(roomId: string, sessionId: string): string {
  return `meeting:${roomId}:session:${sessionId}`;
}

export function matchesPicomMeetingLiveKitRoomName(roomName: string, roomId: string, sessionId: string): boolean {
  return roomName === createPicomMeetingLiveKitRoomName(roomId, sessionId);
}
