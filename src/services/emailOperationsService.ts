import { getSupabaseClient } from "./supabase/supabaseClient";

export type EmailPreferences = Readonly<{
  required_account_security: boolean;
  support_updates: boolean;
  community_updates: boolean;
  product_announcements: boolean;
  radio_podcast_updates: boolean;
  optional_digest: boolean;
  marketing_advertising: boolean;
  locale: string;
}>;

export type EmailOperation = Readonly<{
  id: string;
  template_id: string;
  status: string;
  recipient_domain: string;
  attempt_count: number;
  created_at: string;
  last_error_code: string | null;
  correlation_id: string;
}>;

type ApiEnvelope<T> = Readonly<{ ok?: boolean; data?: T; error?: { code?: string; message?: string } }>;
type ServiceResult<T> = { ok: true; data: T } | { ok: false; message: string };

const defaultPreferences: EmailPreferences = {
  required_account_security: true,
  support_updates: true,
  community_updates: true,
  product_announcements: true,
  radio_podcast_updates: true,
  optional_digest: false,
  marketing_advertising: false,
  locale: "en",
};

async function invoke<T>(action: string, payload: Record<string, unknown> = {}): Promise<ServiceResult<T>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, message: "Email services are unavailable while Picom is offline." };
  const { data, error } = await client.functions.invoke("email-api", { body: { action, ...payload } });
  const envelope = data as ApiEnvelope<T> | null;
  if (error || !envelope?.ok || envelope.data === undefined) {
    return { ok: false, message: envelope?.error?.message ?? "Picom could not complete the email request." };
  }
  return { ok: true, data: envelope.data };
}

function normalizePreferences(value: unknown): EmailPreferences {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    required_account_security: true,
    support_updates: typeof row.support_updates === "boolean" ? row.support_updates : defaultPreferences.support_updates,
    community_updates: typeof row.community_updates === "boolean" ? row.community_updates : defaultPreferences.community_updates,
    product_announcements: typeof row.product_announcements === "boolean" ? row.product_announcements : defaultPreferences.product_announcements,
    radio_podcast_updates: typeof row.radio_podcast_updates === "boolean" ? row.radio_podcast_updates : defaultPreferences.radio_podcast_updates,
    optional_digest: typeof row.optional_digest === "boolean" ? row.optional_digest : defaultPreferences.optional_digest,
    marketing_advertising: typeof row.marketing_advertising === "boolean" ? row.marketing_advertising : defaultPreferences.marketing_advertising,
    locale: typeof row.locale === "string" ? row.locale : defaultPreferences.locale,
  };
}

export const emailOperationsService = {
  async getPreferences(): Promise<ServiceResult<EmailPreferences>> {
    const result = await invoke<unknown>("preferences.get");
    return result.ok ? { ok: true, data: normalizePreferences(result.data) } : result;
  },
  async updatePreferences(patch: Partial<EmailPreferences>): Promise<ServiceResult<EmailPreferences>> {
    const result = await invoke<unknown>("preferences.update", { preferences: patch });
    return result.ok ? { ok: true, data: normalizePreferences(result.data) } : result;
  },
  submitSupport(input: Readonly<{ subject: string; message: string; locale?: string }>) {
    return invoke<{ status: string; submissionId: string }>("support.submit", input);
  },
  submitContact(input: Readonly<{ name: string; email: string; subject: string; message: string; turnstileToken: string; locale?: string }>) {
    return invoke<{ status: string; submissionId: string }>("contact.submit", input);
  },
  getAdminSummary() { return invoke<Record<string, unknown>>("admin.summary"); },
  getAdminOperations(limit = 50) { return invoke<EmailOperation[]>("admin.list", { limit }); },
  retry(messageId: string) { return invoke<{ updated: boolean }>("admin.retry", { messageId }); },
  cancel(messageId: string) { return invoke<{ updated: boolean }>("admin.cancel", { messageId }); },
  sendAdminTest(locale = "en") { return invoke<{ status: string; messageId: string }>("admin.test", { locale }); },
};
