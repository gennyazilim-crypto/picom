export type EmailProvider = "log" | "smtp_placeholder";

export type EmailIntentType =
  | "email_verification_placeholder"
  | "password_reset_placeholder"
  | "invite_placeholder"
  | "security_alert_placeholder"
  | "notification_digest_placeholder";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  intentType?: EmailIntentType;
  metadata?: Record<string, string | number | boolean | null>;
};

export type EmailSendResult =
  | { ok: true; provider: EmailProvider; messageId: string }
  | { ok: false; provider: EmailProvider; code: "SMTP_PROVIDER_NOT_CONFIGURED" | "EMAIL_VALIDATION_FAILED"; message: string };

type EmailServiceOptions = {
  provider?: EmailProvider;
  logger?: Pick<Console, "info" | "warn">;
};

function getProviderFromEnv(): EmailProvider {
  try {
    return Deno.env.get("EMAIL_PROVIDER") === "smtp_placeholder" ? "smtp_placeholder" : "log";
  } catch {
    return "log";
  }
}

function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getEmailDomain(value: string): string {
  return value.split("@")[1]?.toLowerCase() ?? "unknown-domain";
}

function redactTokenPreview(value: string | undefined): string {
  if (!value) {
    return "not-provided";
  }

  if (value.length <= 8) {
    return "[redacted]";
  }

  return `${value.slice(0, 4)}...[redacted]`;
}

function createMessageId(intentType: EmailIntentType | undefined): string {
  return `email_${intentType ?? "generic"}_${Date.now()}`;
}

export function createEmailService(options: EmailServiceOptions = {}) {
  const provider = options.provider ?? getProviderFromEnv();
  const logger = options.logger ?? console;

  async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    const subject = message.subject.trim();
    if (!isValidEmailAddress(message.to) || !subject || !message.text.trim()) {
      return {
        ok: false,
        provider,
        code: "EMAIL_VALIDATION_FAILED",
        message: "Email recipient, subject, and text body are required.",
      };
    }

    if (provider === "smtp_placeholder") {
      logger.warn("SMTP email provider placeholder is not configured", {
        intentType: message.intentType ?? "unknown",
        toDomain: getEmailDomain(message.to),
      });
      return {
        ok: false,
        provider,
        code: "SMTP_PROVIDER_NOT_CONFIGURED",
        message: "SMTP provider placeholder is not configured.",
      };
    }

    logger.info("Email placeholder intent", {
      intentType: message.intentType ?? "unknown",
      toDomain: getEmailDomain(message.to),
      subject,
      metadata: message.metadata ?? {},
    });

    return {
      ok: true,
      provider,
      messageId: createMessageId(message.intentType),
    };
  }

  return {
    sendEmail,

    sendPasswordResetEmailPlaceholder(input: { to: string; resetToken?: string }) {
      return sendEmail({
        to: input.to,
        subject: "Picom password reset placeholder",
        text: "A password reset was requested for your Picom account. This is a placeholder email intent.",
        intentType: "password_reset_placeholder",
        metadata: {
          resetTokenPreview: redactTokenPreview(input.resetToken),
        },
      });
    },

    sendVerificationEmailPlaceholder(input: { to: string; verificationToken?: string }) {
      return sendEmail({
        to: input.to,
        subject: "Picom email verification placeholder",
        text: "Verify your Picom email address. This is a placeholder email intent.",
        intentType: "email_verification_placeholder",
        metadata: {
          verificationTokenPreview: redactTokenPreview(input.verificationToken),
        },
      });
    },

    sendInviteEmailPlaceholder(input: { to: string; communityName: string; inviteCode?: string }) {
      return sendEmail({
        to: input.to,
        subject: `Picom invite placeholder: ${input.communityName}`,
        text: "You were invited to a Picom community. This is a placeholder email intent.",
        intentType: "invite_placeholder",
        metadata: {
          communityName: input.communityName,
          inviteCodePreview: redactTokenPreview(input.inviteCode),
        },
      });
    },
  };
}
