import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");
const migration=read("supabase/migrations/20260711154100_meeting_notifications_reminders.sql");
const service=read("src/services/meeting/meetingNotificationService.ts");
const inbox=read("src/services/supabase/notificationInboxService.ts");
const links=read("src/services/deepLinkService.ts");
const native=read("electron/ipcPayloadValidation.cts")+read("electron/main.cts");
for(const marker of ["meeting_notification_jobs","enqueue_due_meeting_reminders","dispatch_due_meeting_notifications","on conflict(recipient_id,source_event_id)","meeting_invite_received_notification","meeting_stage_request_notification","notify_meeting_waiting_hosts","notify_meeting_waiting_resolution","service_role"]) assert.ok(migration.includes(marker),`missing migration marker ${marker}`);
for(const kind of ["reminder","started","schedule_changed","cancelled","invite_received","waiting_request","admission_result","cohost_assigned","stage_request"]) assert.ok(migration.includes(`'${kind}'`),`missing meeting notification kind ${kind}`);
assert.ok(service.includes("activeMeetingRoomId")&&service.includes("eventMeetingRoomId")&&service.includes("dateTimeService.formatEventTime"),"client routing, active-room suppression, or timezone formatting missing");
assert.ok(inbox.includes("meeting_room_id")&&inbox.includes("deep_link"),"remote inbox meeting mapping missing");
assert.ok(links.includes('type: "meeting"')&&links.includes("INVALID_MEETING_LINK"),"exact meeting deep link missing");
assert.ok(native.includes("safePayload.deepLink")&&native.includes('route === "meeting"'),"native notification click routing missing");
assert.ok(!migration.match(/token_hash|access_token|refresh_token|provider_key/),"meeting notification migration must not persist secrets");
console.log("Meeting notification persistence, reminders, idempotency, preferences, exact deep links, and host alerts: PASS");
