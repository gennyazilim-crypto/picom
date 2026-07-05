export const liveKitRoomPrefix = "picom";

export function createPicomLiveKitRoomName(communityId: string, channelId: string): string {
  return `${liveKitRoomPrefix}:${communityId}:${channelId}`;
}

export function isPicomLiveKitRoomName(roomName: string): boolean {
  return roomName.startsWith(`${liveKitRoomPrefix}:`) && roomName.split(":").length === 3;
}
