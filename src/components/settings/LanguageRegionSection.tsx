import { useMemo, useState } from "react";
import type { AppearanceSettings, UiLanguage } from "../../services/settingsService";
import { translateSettings } from "../../services/settings/settingsI18n";
import { getUiLanguageBcp47, listUiLanguageMetadata } from "../../services/localization/uiLanguages";
import { dateTimeService } from "../../services/dateTimeService";

/**
 * Settings -> Preferences -> Language & Region.
 * Sole owner of the app-language control (the Appearance section no longer renders a
 * duplicate selector). Selecting a language pins languageMode to "manual"; the
 * "use system language" toggle switches back to "system" so the OS locale is re-resolved
 * on every launch. Changes apply immediately -- no restart, no explicit save step.
 */
export function LanguageRegionSection({
  appearanceSettings,
  onUpdateAppearance,
}: Readonly<{
  appearanceSettings: AppearanceSettings;
  onUpdateAppearance: (partial: Partial<AppearanceSettings>) => void;
}>) {
  const language = appearanceSettings.language;
  const t = (key: Parameters<typeof translateSettings>[0], params?: Record<string, string | number>) =>
    translateSettings(key, language, params);
  const [query, setQuery] = useState("");

  const usingSystemLanguage = appearanceSettings.languageMode === "system";
  const activeLocaleTag = getUiLanguageBcp47(language);

  const options = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(getUiLanguageBcp47(language));
    return listUiLanguageMetadata().filter((meta) => {
      if (!needle) return true;
      return (
        meta.nativeLabel.toLocaleLowerCase(meta.bcp47).includes(needle) ||
        meta.englishLabel.toLowerCase().includes(needle) ||
        meta.code.includes(needle)
      );
    });
  }, [language, query]);

  // Fixed sample instant so the preview is deterministic and comparable across languages.
  const preview = useMemo(() => {
    const sample = new Date("2026-03-09T14:05:00Z");
    const relativeBase = new Date(sample.getTime() + 3 * 60 * 60 * 1000);
    let numberSample = String(1234567.89);
    try {
      numberSample = new Intl.NumberFormat(activeLocaleTag).format(1234567.89);
    } catch {
      /* Intl unavailable for this tag -- keep the plain-number fallback. */
    }
    return {
      date: dateTimeService.formatEventDay(sample, { locale: activeLocaleTag }),
      time: dateTimeService.formatMessageTime(sample, { locale: activeLocaleTag }),
      number: numberSample,
      relative: dateTimeService.formatRelativeTime(sample, { locale: activeLocaleTag, now: relativeBase }),
    };
  }, [activeLocaleTag]);

  return (
    <section className="settings-section" aria-label={t("language.title")}>
      <header className="settings-section-header">
        <h3>{t("language.title")}</h3>
        <p>{t("language.description")}</p>
      </header>

      <div className="accessibility-card">
        <label className="settings-toggle-row">
          <span>
            <strong>{t("language.useSystem")}</strong>
            <small>{t("language.useSystemHint")}</small>
          </span>
          <input
            type="checkbox"
            checked={usingSystemLanguage}
            onChange={(event) =>
              onUpdateAppearance(
                event.target.checked ? { languageMode: "system" } : { languageMode: "manual", language },
              )
            }
          />
        </label>
      </div>

      <div className="accessibility-card" aria-label={t("language.appLanguage")}>
        <div className="settings-field">
          <strong>{t("language.appLanguage")}</strong>
          <small>{t("language.appLanguageHint")}</small>
        </div>

        <input
          type="search"
          className="settings-search-input"
          value={query}
          placeholder={t("language.searchPlaceholder")}
          aria-label={t("language.searchAria")}
          onChange={(event) => setQuery(event.target.value)}
        />

        {options.length === 0 ? (
          <p role="status">{t("language.noResults", { query: query.trim() })}</p>
        ) : (
          <ul className="language-option-list" role="listbox" aria-label={t("language.appLanguage")}>
            {options.map((meta) => {
              const isActive = meta.code === language;
              return (
                <li key={meta.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    aria-label={t("language.selectAria", { name: meta.englishLabel })}
                    className={`language-option${isActive ? " is-active" : ""}`}
                    onClick={() => onUpdateAppearance({ language: meta.code as UiLanguage, languageMode: "manual" })}
                  >
                    <span className="language-option__native" lang={meta.bcp47}>
                      {meta.nativeLabel}
                    </span>
                    <span className="language-option__english">{meta.englishLabel}</span>
                    <span className="language-option__tag">{meta.bcp47}</span>
                    {isActive ? <span className="language-option__selected">{t("language.selected")}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="accessibility-card" aria-label={t("language.previewTitle")}>
        <div className="settings-field">
          <strong>{t("language.previewTitle")}</strong>
          <small>
            {t("language.activeLocale")}: <code>{activeLocaleTag}</code>
          </small>
        </div>
        <dl className="language-preview">
          <div>
            <dt>{t("language.previewDate")}</dt>
            <dd>{preview.date}</dd>
          </div>
          <div>
            <dt>{t("language.previewTime")}</dt>
            <dd>{preview.time}</dd>
          </div>
          <div>
            <dt>{t("language.previewNumber")}</dt>
            <dd>{preview.number}</dd>
          </div>
          <div>
            <dt>{t("language.previewRelative")}</dt>
            <dd>{preview.relative}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
