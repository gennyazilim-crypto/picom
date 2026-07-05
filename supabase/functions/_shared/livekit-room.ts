export const liveKitRoomPrefix = "picom";

export function createPicomLiveKitRoomName(communityId: string, channelId: string): string {
  return `${liveKitRoomPrefix}:${communityId}:${channelId}`;
}

export function matchesPicomLiveKitRoomName(roomName: string, communityId: string, channelId: string): boolean {
  return roomName === createPicomLiveKitRoomName(communityId, channelId);
}
