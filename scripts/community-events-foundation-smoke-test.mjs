import fs from "node:fs";
const service=fs.readFileSync("src/services/communityEventService.ts","utf8");const reminder=fs.readFileSync("src/services/eventReminderService.ts","utf8");const migration=fs.readFileSync("supabase/migrations/20260710181000_event_rsvp_reminders.sql","utf8");const ui=fs.readFileSync("src/components/CommunityEventsAdminSection.tsx","utf8");const doc=fs.readFileSync("docs/community-events-scheduled-sessions.md","utf8");
for(const marker of ["updateEvent","cancelEvent","setRsvp","set_community_event_rsvp"])if(!service.includes(marker))throw new Error(`Event service missing ${marker}`);
for(const marker of ["notificationService.showNotification","category: \"event_reminder\"","communityId: event.communityId","minutesBefore"])if(!reminder.includes(marker))throw new Error(`Reminder service missing ${marker}`);
for(const marker of ["community_event_rsvps","community_event_reminders","unique(event_id,user_id)","is_community_member"])if(!migration.includes(marker))throw new Error(`Event migration missing ${marker}`);
for(const marker of ["Edit","Remind me","Interested","Not going"])if(!ui.includes(marker))throw new Error(`Event UI missing ${marker}`);
for(const marker of ["No external calendar", "notification preferences", "manual checklist"])if(!doc.includes(marker))throw new Error(`Event docs missing ${marker}`);
console.log("Community events RSVP and reminders smoke passed.");
