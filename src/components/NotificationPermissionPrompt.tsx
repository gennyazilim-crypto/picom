import type { NotificationPermissionPrompt as NotificationPermissionPromptData } from "../services/notificationPermissionOnboardingService";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";

type NotificationPermissionPromptProps = {
  prompt: NotificationPermissionPromptData;
  onAllow: () => void;
  onDismiss: () => void;
};

const iconMap = mvpUiIconMap.chatHeader;

export function NotificationPermissionPrompt({ prompt, onAllow, onDismiss }: NotificationPermissionPromptProps) {
  return (
    <section className="notification-permission-prompt" role="dialog" aria-modal="false" aria-label="Notification permission onboarding">
      <div className="notification-permission-icon">
        <AppIcon name={iconMap.notifications} size="lg" />
      </div>
      <div className="notification-permission-copy">
        <strong>{prompt.title}</strong>
        <p>{prompt.body}</p>
        <div className="notification-permission-benefits">
          {prompt.benefits.map((benefit) => <span key={benefit}>{benefit}</span>)}
        </div>
      </div>
      <div className="notification-permission-actions">
        <button type="button" className="ghost-button" onClick={onDismiss}>Not now</button>
        <button type="button" className="primary-button" onClick={onAllow}>Allow notifications</button>
      </div>
    </section>
  );
}

