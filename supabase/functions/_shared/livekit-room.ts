export const liveKitRoomPrefix = "community";

export function createPicomLiveKitRoomName(communityId: string, channelId: string): string {
  return `${liveKitRoomPrefix}:${communityId}:voice:${channelId}`;
}

export function matchesPicomLiveKitRoomName(roomName: string, communityId: string, channelId: string): boolean {
  return roomName === createPicomLiveKitRoomName(communityId, channelId);
}
