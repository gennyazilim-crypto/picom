export const liveKitRoomPrefix = "community";

export function createPicomLiveKitRoomName(communityId: string, channelId: string): string {
  return `${liveKitRoomPrefix}:${communityId}:voice:${channelId}`;
}

export function isPicomLiveKitRoomName(roomName: string): boolean {
  const parts = roomName.split(":");
  return parts.length === 4 && parts[0] === liveKitRoomPrefix && parts[2] === "voice";
}
