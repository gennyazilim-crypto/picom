export const EMAIL_LOCALES = ["tr", "en", "de", "fr", "es", "it", "pt", "ru", "ar", "ja"] as const;
export type EmailLocale = typeof EMAIL_LOCALES[number];

export const EMAIL_CATEGORIES = [
  "required_account_security",
  "support_updates",
  "community_updates",
  "product_announcements",
  "radio_podcast_updates",
  "optional_digest",
  "marketing_advertising",
  "billing",
] as const;
export type EmailCategory = typeof EMAIL_CATEGORIES[number];

export const EMAIL_TEMPLATE_IDS = [
  "welcome", "support_ticket_received", "support_internal_contact", "support_reply", "support_ticket_closed",
  "account_warning", "suspension_notice", "appeal_received", "appeal_decision", "community_ownership_transfer",
  "community_invitation", "content_removal", "temporary_restriction", "community_quarantine", "security_alert",
  "new_login", "security_settings_changed", "subscription_confirmation", "payment_failure", "refund_status",
  "incident_status", "optional_digest", "radio_podcast_update", "product_announcement", "marketing_announcement",
] as const;
export type EmailTemplateId = typeof EMAIL_TEMPLATE_IDS[number];

type RpcResult = PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
export type EmailQueueClient = { rpc(name: string, args: Record<string, unknown>): RpcResult };

export type QueueEmailInput = Readonly<{
  to: string;
  recipientUserId?: string | null;
  templateId: EmailTemplateId;
  templateVersion?: number;
  category: EmailCategory;
  locale?: EmailLocale;
  parameters?: Record<string, string | number | boolean | null>;
  idempotencyKey: string;
  correlationId: string;
  priority?: number;
}>;

export type EmailQueueResult =
  | { ok: true; status: "queued"; messageId: string }
  | { ok: false; code: "EMAIL_VALIDATION_FAILED" | "EMAIL_QUEUE_FAILED"; message: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validHeaderSafeText(value: string, min: number, max: number): boolean {
  return value.length >= min && value.length <= max && !/[\r\n]/.test(value);
}

export function createEmailQueueService(client: EmailQueueClient) {
  async function enqueue(input: QueueEmailInput): Promise<EmailQueueResult> {
    const recipient = input.to.trim().toLowerCase();
    const parameters = input.parameters ?? {};
    if (!emailPattern.test(recipient) || recipient.length > 320
      || !EMAIL_TEMPLATE_IDS.includes(input.templateId)
      || !EMAIL_CATEGORIES.includes(input.category)
      || !EMAIL_LOCALES.includes(input.locale ?? "en")
      || !validHeaderSafeText(input.idempotencyKey, 8, 200)
      || !validHeaderSafeText(input.correlationId, 8, 120)
      || (input.recipientUserId && !uuidPattern.test(input.recipientUserId))
      || JSON.stringify(parameters).length > 16_384) {
      return { ok: false, code: "EMAIL_VALIDATION_FAILED", message: "The email request is invalid." };
    }

    const { data, error } = await client.rpc("enqueue_email_message", {
      p_recipient_email: recipient,
      p_recipient_user_id: input.recipientUserId ?? null,
      p_template_id: input.templateId,
      p_template_version: input.templateVersion ?? 1,
      p_category: input.category,
      p_locale: input.locale ?? "en",
      p_parameters: parameters,
      p_idempotency_key: input.idempotencyKey,
      p_correlation_id: input.correlationId,
      p_priority: Math.min(Math.max(Math.round(input.priority ?? 50), 0), 100),
    });

    if (error || typeof data !== "string") {
      return { ok: false, code: "EMAIL_QUEUE_FAILED", message: "The email could not be queued." };
    }
    return { ok: true, status: "queued", messageId: data };
  }

  return { enqueue };
}

