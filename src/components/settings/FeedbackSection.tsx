import type { UiLanguage } from "../../services/settingsService";
import { useState } from "react";
import { AppIcon } from "../AppIcon";
import { FeedbackModal } from "../feedback/FeedbackModal";
import { remoteConfigService } from "../../services/remoteConfigService";
import { externalLinkService } from "../../services/externalLinkService";
import { accountCenterUrls } from "../../config/accountCenterUrls";
import { translateSettings } from "../../services/settings/settingsI18n";
import { settingsService } from "../../services/settingsService";

export function FeedbackSection({
  language,
  onNotice,
}: {
  language?: UiLanguage;
  onNotice: (message: string, tone?: "info" | "success" | "error") => void;
}) {
  const lang = language ?? settingsService.getSettings().appearanceSettings.language;
  const t = (key: Parameters<typeof translateSettings>[0]) => translateSettings(key, lang);
  const [open, setOpen] = useState(false);
  const openSupport = async () => {
    const url = remoteConfigService.getSnapshot().urls.supportUrl || accountCenterUrls.support;
    const result = await externalLinkService.openExternalUrl(url);
    onNotice(result.ok ? t("feedback.supportOpened") : externalLinkService.getUserFriendlyError(result.reason), result.ok ? "success" : "error");
  };

  return (
    <>
      <section id="diagnostics-support" className="diagnostics-settings-section diagnostics-support-card" aria-label={t("feedback.supportTitle")}>
        <span className="diagnostics-support-icon" aria-hidden="true">
          <AppIcon name="bell" size="lg" />
        </span>
        <div className="diagnostics-support-copy">
          <strong>{t("feedback.supportTitle")}</strong>
          <p>{t("feedback.supportBody")}</p>
        </div>
        <div className="settings-actions-row">
          <button type="button" className="settings-inline-action" onClick={() => setOpen(true)}>{t("feedback.prepareReport")}</button>
          <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => void openSupport()}>{t("feedback.openSupport")}</button>
        </div>
      </section>
      {open ? <FeedbackModal onClose={() => setOpen(false)} onNotice={onNotice} /> : null}
    </>
  );
}
