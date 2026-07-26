import { useEffect, useState } from "react";
import { externalLinkService } from "../services/externalLinkService";
import {
  dismissSoftEmailReminder,
  isSoftEmailReminderDismissedThisSession,
  loadSoftEmailStatus,
  markNativeSoftEmailNotificationShown,
  markSoftEmailSuccessSeen,
  resendSoftEmailVerification,
  shouldShowNativeSoftEmailNotification,
  softEmailCheckInboxUrl,
  softEmailSecurityUrl,
  type SoftEmailStatusSnapshot,
} from "../services/softEmailVerificationService";
import "./SoftEmailVerificationBanner.css";

type Props = {
  userId: string | null | undefined;
  pushToast: (message: string, tone?: "success" | "error" | "info") => void;
};

/**
 * Non-blocking soft email verification banner for Desktop shell.
 * Must never gate feed/DM/community usage.
 */
export function SoftEmailVerificationBanner({ userId, pushToast }: Props) {
  const [status, setStatus] = useState<SoftEmailStatusSnapshot | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) {
      setStatus(null);
      setVisible(false);
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      const next = await loadSoftEmailStatus();
      if (cancelled) return;
      setStatus(next);

      if (next.isEmailVerified) {
        setVisible(false);
        if (!next.successSeenAt) {
          pushToast("E-posta adresiniz doğrulandı. PICOM hesabınızın e-posta doğrulaması başarıyla tamamlandı.", "success");
          await markSoftEmailSuccessSeen();
        }
        return;
      }

      if (isSoftEmailReminderDismissedThisSession() || next.reminderDismissedAt) {
        setVisible(false);
      } else {
        setVisible(true);
      }

      if (shouldShowNativeSoftEmailNotification(next) && "Notification" in window) {
        try {
          if (Notification.permission === "granted") {
            const note = new Notification("PICOM e-posta doğrulaması", {
              body: "Hesap güvenliğiniz için e-posta adresinizi doğrulayın.",
            });
            note.onclick = () => {
              void externalLinkService.openExternalUrl(softEmailSecurityUrl());
            };
            markNativeSoftEmailNotificationShown();
          }
        } catch {
          // Native notifications are optional.
        }
      }
    };

    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => {
      void refresh();
    }, 120_000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [userId, pushToast]);

  if (!visible || !status || status.isEmailVerified) return null;

  return (
    <div className="soft-email-banner" role="status">
      <div className="soft-email-banner__copy">
        <strong>E-postanı doğrula</strong>
        <p title="Hesap kurtarma için e-posta doğrulaması önerilir.">
          Kurtarma için önerilir — PICOM’u kullanmaya devam edebilirsin.
        </p>
        {status.offline ? <small>Durum yenilenemiyor.</small> : null}
      </div>
      <div className="soft-email-banner__actions">
        <button
          type="button"
          className="soft-email-banner__btn soft-email-banner__btn--primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void resendSoftEmailVerification().then((result) => {
              setBusy(false);
              if (!result.ok) {
                pushToast(result.message, "error");
                return;
              }
              pushToast("Doğrulama e-postası gönderildi.", "success");
            });
          }}
        >
          Gönder
        </button>
        <button
          type="button"
          className="soft-email-banner__btn"
          onClick={() => {
            void externalLinkService.openExternalUrl(softEmailCheckInboxUrl());
          }}
        >
          Gelen kutusu
        </button>
        <button
          type="button"
          className="soft-email-banner__btn soft-email-banner__btn--ghost"
          aria-label="Daha sonra"
          onClick={() => {
            setVisible(false);
            void dismissSoftEmailReminder();
          }}
        >
          Sonra
        </button>
      </div>
    </div>
  );
}
