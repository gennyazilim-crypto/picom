import type { UiLanguage } from "../../services/settingsService";
import { useEffect, useState } from "react";
import { appConfig } from "../../config/appConfig";
import { legalConfig } from "../../config/legalConfig";
import { legalDocumentOrder, legalDocuments, type LegalDocumentId } from "../../data/legalDocuments";
import { authService } from "../../services/authService";
import { dateTimeService } from "../../services/dateTimeService";
import { termsAcceptanceService, type TermsAcceptanceStatus } from "../../services/termsAcceptanceService";
import { translateSettings } from "../../services/settings/settingsI18n";
import { settingsService } from "../../services/settingsService";
import { AppIcon } from "../AppIcon";

type LegalSettingsSectionProps = {
  language?: UiLanguage;
  onOpenDocument: (documentId: LegalDocumentId) => void;
};

export function LegalSettingsSection({ language, onOpenDocument }: LegalSettingsSectionProps) {
  const lang = language ?? settingsService.getSettings().appearanceSettings.language;
  const t = (key: Parameters<typeof translateSettings>[0], params?: Record<string, string | number>) =>
    translateSettings(key, lang, params);
  const [acceptance, setAcceptance] = useState<TermsAcceptanceStatus | null>(null);
  const [acceptanceBusy, setAcceptanceBusy] = useState(false);
  const [acceptanceError, setAcceptanceError] = useState<string | null>(null);

  const refreshAcceptance = async () => {
    setAcceptanceBusy(true);
    setAcceptanceError(null);
    try {
      const userResult = await authService.getCurrentUser();
      if (!userResult.ok) {
        setAcceptance(null);
        setAcceptanceError(userResult.error.message);
        return;
      }
      if (!userResult.data?.id) {
        setAcceptance(null);
        setAcceptanceError(t("legal.signInToReview"));
        return;
      }
      const status = await termsAcceptanceService.getStatus(userResult.data.id);
      setAcceptance(status);
    } catch {
      setAcceptance(null);
      setAcceptanceError(t("legal.loadFailed"));
    } finally {
      setAcceptanceBusy(false);
    }
  };

  useEffect(() => {
    void refreshAcceptance();
  }, [lang]);

  const acceptanceStrong = acceptanceBusy
    ? t("legal.checkingAcceptance")
    : acceptance?.accepted
      ? t("legal.currentAccepted")
      : acceptance
        ? t("legal.reacceptRequired")
        : t("legal.acceptanceUnavailable");

  const acceptanceDetail = acceptanceError
    ? acceptanceError
    : acceptance?.acceptedAt
      ? t("legal.recordedAcceptance", {
          when: dateTimeService.formatFullTimestamp(acceptance.acceptedAt),
          source: acceptance.source ? ` · ${acceptance.source}` : "",
          terms: acceptance.acceptedTermsVersion ?? "—",
          privacy: acceptance.acceptedPrivacyVersion ?? "—",
        })
      : t("legal.packageAcceptance", { version: legalConfig.currentVersion });

  return (
    <div className="legal-settings-stack">
      <p className="settings-section-description">{t("legal.description")}</p>

      <section className="legal-settings-section" aria-label={t("legal.versionSectionAria")}>
        <div className="settings-status-card settings-feature-card settings-feature-card--highlight">
          <span>{t("legal.versionSectionAria")} {legalConfig.currentVersion}</span>
          <strong>{t("legal.professionalReview")}</strong>
          <small>{t("legal.versionHelp")}</small>
        </div>

        <div className="settings-status-card settings-feature-card" aria-live="polite">
          <span>{t("legal.yourAcceptance")}</span>
          <strong>{acceptanceStrong}</strong>
          <small>{acceptanceDetail}</small>
          <div className="settings-actions-row">
            <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={acceptanceBusy} onClick={() => void refreshAcceptance()}>
              {acceptanceBusy ? t("legal.refreshingAcceptance") : t("legal.refreshAcceptance")}
            </button>
          </div>
        </div>
      </section>

      <section className="legal-settings-section" aria-label={t("legal.documentsAria")}>
        <h3 className="legal-settings-section-title">{t("legal.documentsTitle")}</h3>
        <div className="legal-settings-panel">
          {legalDocumentOrder.map((documentId) => {
            const document = legalDocuments[documentId];
            return (
              <button
                type="button"
                key={documentId}
                aria-label={t("legal.openDocument", { title: document.title })}
                onClick={() => onOpenDocument(documentId)}
              >
                <span>
                  <strong>{document.title}</strong>
                  <small>{document.updatedLabel}</small>
                </span>
                <AppIcon name="chevronRight" size="sm" />
              </button>
            );
          })}
        </div>
      </section>

      <small className="legal-settings-footer">
        {t("legal.footer", {
          version: appConfig.version,
          channel: appConfig.releaseChannel,
          legalVersion: legalConfig.currentVersion,
        })}
      </small>
    </div>
  );
}
