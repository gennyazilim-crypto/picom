import { meetingPreJoinService } from "./meeting/meetingPreJoinService.ts";
import { voiceDeviceService } from "./voiceDeviceService.ts";
import { runRegisteredFirstLaunchMediaCleanups } from "./firstLaunchMediaCleanupRegistry.ts";

export { registerFirstLaunchMediaCleanup } from "./firstLaunchMediaCleanupRegistry.ts";

/** Stops every first-run mic, speaker, camera, and screen preview before leaving setup. */
export function releaseFirstLaunchMediaResources(): void {
  voiceDeviceService.stopTests();
  meetingPreJoinService.stopDevicePreviews();
  runRegisteredFirstLaunchMediaCleanups();
}
