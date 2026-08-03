/**
 * Event + publisher schedule reminder worker — claims due reminders and delivers
 * inbox + email notifications with idempotent status updates.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: EVENT_REMINDER_POLL_MS (default 15000), EVENT_REMINDER_BATCH_SIZE (25)
 */
import os from "node:os";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const required = (name) => {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`EVENT_REMINDER_CONFIG_MISSING:${name}`);
  return value;
};

const config = Object.freeze({
  supabaseUrl: required("SUPABASE_URL"),
  serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  pollMs: Math.min(Math.max(Number(process.env.EVENT_REMINDER_POLL_MS ?? 15000), 2000), 120000),
  batchSize: Math.min(Math.max(Number(process.env.EVENT_REMINDER_BATCH_SIZE ?? 25), 1), 100),
});

const workerId = `event-reminder:${os.hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let shuttingDown = false;
let processing = false;

async function markEventReminder(id, deliveryStatus) {
  await supabase
    .from("community_event_reminders")
    .update({
      delivery_status: deliveryStatus,
      sent_at: deliveryStatus === "sent" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

async function markPublisherReminder(id, deliveryStatus) {
  await supabase
    .from("publisher_stream_schedule_reminders")
    .update({
      delivery_status: deliveryStatus,
      sent_at: deliveryStatus === "sent" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

async function deliverEventReminder(reminder) {
  const { data: event } = await supabase
    .from("community_events")
    .select("id,title,starts_at,timezone,status,cancelled_at")
    .eq("id", reminder.event_id)
    .maybeSingle();

  if (!event || event.cancelled_at || !["published", "live"].includes(event.status)) {
    await markEventReminder(reminder.id, "cancelled");
    return;
  }

  const starts = new Date(event.starts_at).toLocaleString("en-GB", {
    timeZone: event.timezone || "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const summary = `${event.title} starts at ${starts} (${event.timezone || "UTC"}).`;
  const idempotency = reminder.idempotency_key || `event-reminder:${reminder.id}`;

  await supabase.from("event_notifications").insert({
    event_id: reminder.event_id,
    user_id: reminder.user_id,
    actor_id: null,
    type: "reminder",
    metadata: {
      reminderId: reminder.id,
      minutesBefore: reminder.minutes_before,
      idempotencyKey: idempotency,
    },
  });

  if (reminder.channel === "email" || reminder.channel === "app") {
    await supabase.rpc("enqueue_email_for_user_event", {
      target_user_id: reminder.user_id,
      target_template_id: "event_reminder",
      target_category: "community_updates",
      target_parameters: {
        summary,
        reference: event.title,
        actionUrl: `https://app.picom.gg/events/${event.id}`,
        actionLabel: "Open event",
      },
      target_idempotency_key: idempotency,
      target_correlation_id: idempotency,
      target_priority: 60,
      target_hook_name: "event_reminder_worker",
      target_source_record_id: reminder.id,
    });
  }

  await markEventReminder(reminder.id, "sent");
}

async function deliverPublisherScheduleReminder(reminder) {
  const { data: schedule } = await supabase
    .from("publisher_stream_schedules")
    .select("id,title,scheduled_start_at,timezone,status,owner_user_id")
    .eq("id", reminder.schedule_id)
    .maybeSingle();

  if (!schedule || !["scheduled", "ready"].includes(schedule.status)) {
    await markPublisherReminder(reminder.id, "cancelled");
    return;
  }

  const starts = new Date(schedule.scheduled_start_at).toLocaleString("en-GB", {
    timeZone: schedule.timezone || "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const summary = `${schedule.title} starts at ${starts} (${schedule.timezone || "UTC"}).`;
  const idempotency =
    reminder.idempotency_key ||
    `publisher-schedule-reminder:${reminder.schedule_id}:${reminder.user_id}:v1`;

  await supabase.from("notifications").insert({
    recipient_id: reminder.user_id,
    actor_id: schedule.owner_user_id,
    category: "event",
    title: schedule.title,
    preview: summary,
    context_kind: "system",
    context_label: "Live schedule",
    user_id: schedule.owner_user_id,
    source_event_id: idempotency,
    deep_link: null,
  });

  if (reminder.channel === "email" || reminder.channel === "app") {
    await supabase.rpc("enqueue_email_for_user_event", {
      target_user_id: reminder.user_id,
      target_template_id: "event_reminder",
      target_category: "community_updates",
      target_parameters: {
        summary,
        reference: schedule.title,
        actionUrl: "https://app.picom.gg/live-now",
        actionLabel: "Open Live Now",
      },
      target_idempotency_key: idempotency,
      target_correlation_id: idempotency,
      target_priority: 60,
      target_hook_name: "publisher_schedule_reminder_worker",
      target_source_record_id: reminder.id,
    });
  }

  await markPublisherReminder(reminder.id, "sent");
}

async function tick() {
  if (shuttingDown || processing) return;
  processing = true;
  try {
    const { data, error } = await supabase.rpc("claim_event_reminders", {
      p_worker_id: workerId,
      p_batch_size: config.batchSize,
    });
    if (error) {
      console.error(JSON.stringify({ level: "error", msg: "claim_failed", error: error.message, workerId }));
    } else {
      for (const reminder of data ?? []) {
        try {
          await deliverEventReminder(reminder);
        } catch (err) {
          console.error(JSON.stringify({ level: "error", msg: "deliver_failed", id: reminder.id, error: String(err?.message || err) }));
          await markEventReminder(reminder.id, "failed");
        }
      }
    }

    const publisherClaim = await supabase.rpc("claim_publisher_stream_schedule_reminders", {
      p_worker_id: workerId,
      p_batch_size: config.batchSize,
    });
    if (publisherClaim.error) {
      console.error(JSON.stringify({
        level: "error",
        msg: "publisher_claim_failed",
        error: publisherClaim.error.message,
        workerId,
      }));
    } else {
      for (const reminder of publisherClaim.data ?? []) {
        try {
          await deliverPublisherScheduleReminder(reminder);
        } catch (err) {
          console.error(JSON.stringify({
            level: "error",
            msg: "publisher_deliver_failed",
            id: reminder.id,
            error: String(err?.message || err),
          }));
          await markPublisherReminder(reminder.id, "failed");
        }
      }
    }
  } finally {
    processing = false;
  }
}

const timer = setInterval(() => { void tick(); }, config.pollMs);
void tick();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    shuttingDown = true;
    clearInterval(timer);
    console.log(JSON.stringify({ level: "info", msg: "shutdown", workerId }));
    process.exit(0);
  });
}

console.log(JSON.stringify({
  level: "info",
  msg: "event_reminder_worker_started",
  workerId,
  pollMs: config.pollMs,
  publisherSchedules: true,
}));
