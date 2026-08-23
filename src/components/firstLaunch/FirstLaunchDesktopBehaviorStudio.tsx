import { useState } from "react";
import { useTranslation } from "../../i18n";
import {
  desktopBehaviorService,
  type DesktopBehaviorPreferences,
  type DesktopCloseBehavior,
  type DesktopStartupDestination,
  type DesktopStartupVisibility,
} from "../../services/desktop/desktopBehaviorService";

type FirstLaunchDesktopBehaviorStudioProps = Readonly<{
  preferences: DesktopBehaviorPreferences;
}>;

export function FirstLaunchDesktopBehaviorStudio({ preferences }: FirstLaunchDesktopBehaviorStudioProps) {
  const { t } = useTranslation("firstLaunch");
  const [busy, setBusy] = useState<"startup" | "preferences" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startupSupported = preferences.startupCapability === "supported";

  const updateStartup = async (enabled: boolean) => {
    setBusy("startup");
    setError(null);
    const next = await desktopBehaviorService.setLaunchAtStartup(enabled);
    setBusy(null);
    if (next.startupCapability !== "supported" || next.launchAtStartup !== enabled) {
      setError(t("desktop.error.startupUpdate"));
    }
  };

  const updatePreferences = async (patch: Readonly<{
    startupVisibility?: DesktopStartupVisibility;
    closeBehavior?: DesktopCloseBehavior;
    startupDestination?: DesktopStartupDestination;
  }>) => {
    setBusy("preferences");
    setError(null);
    const next = await desktopBehaviorService.updatePreferences(patch);
    setBusy(null);
    if (
      (patch.closeBehavior === "tray" && next.closeBehavior !== "tray") ||
      (patch.startupVisibility && next.startupVisibility !== patch.startupVisibility) ||
      (patch.startupDestination && next.startupDestination !== patch.startupDestination)
    ) {
      setError(t("desktop.error.preferenceUpdate"));
    }
  };

  const startupCapabilityMessage = preferences.startupCapability === "supported"
    ? null
    : preferences.startupCapability === "dev-unavailable"
      ? t("desktop.startupDevUnavailable")
      : preferences.startupCapability === "unsupported"
        ? t("desktop.startupUnsupported")
        : t("desktop.startupUnavailable");

  return (
    <div className="first-launch-desktop-studio">
      <section className="first-launch-desktop-group" aria-labelledby="first-launch-desktop-startup">
        <div className="first-launch-desktop-group-heading">
          <h3 id="first-launch-desktop-startup">{t("desktop.startupLegend")}</h3>
          <p>{t("desktop.startupDescription")}</p>
        </div>
        <label className="first-launch-desktop-toggle">
          <span><strong>{t("desktop.launchAtStartup")}</strong><small>{t("desktop.launchAtStartupHint")}</small></span>
          <input
            type="checkbox"
            checked={preferences.launchAtStartup}
            disabled={!startupSupported || busy !== null}
            onChange={(event) => void updateStartup(event.target.checked)}
            aria-describedby={startupCapabilityMessage ? "first-launch-desktop-startup-status" : undefined}
          />
        </label>
        {startupCapabilityMessage ? <p id="first-launch-desktop-startup-status" className="first-launch-desktop-capability" role="status">{startupCapabilityMessage}</p> : null}

        <fieldset className="first-launch-desktop-options" disabled={!startupSupported || !preferences.launchAtStartup || busy !== null}>
          <legend>{t("desktop.startupVisibilityLegend")}</legend>
          <p>{t("desktop.startupVisibilityHint")}</p>
          <RadioOption
            name="first-launch-startup-visibility"
            value="normal"
            checked={preferences.startupVisibility === "normal"}
            onChange={() => void updatePreferences({ startupVisibility: "normal" })}
            label={t("desktop.startupNormal")}
            description={t("desktop.startupNormalHint")}
          />
          <RadioOption
            name="first-launch-startup-visibility"
            value="tray"
            checked={preferences.startupVisibility === "tray"}
            onChange={() => void updatePreferences({ startupVisibility: "tray" })}
            label={t("desktop.startupTray")}
            description={t("desktop.startupTrayHint")}
          />
        </fieldset>
      </section>

      <section className="first-launch-desktop-group" aria-labelledby="first-launch-desktop-window">
        <div className="first-launch-desktop-group-heading">
          <h3 id="first-launch-desktop-window">{t("desktop.closeLegend")}</h3>
          <p>{t("desktop.closeDescription")}</p>
        </div>
        <fieldset className="first-launch-desktop-options" disabled={busy !== null}>
          <legend className="sr-only">{t("desktop.closeLegend")}</legend>
          {preferences.trayAvailable ? <RadioOption
            name="first-launch-close-behavior"
            value="tray"
            checked={preferences.closeBehavior === "tray"}
            onChange={() => void updatePreferences({ closeBehavior: "tray" })}
            label={t("desktop.closeTray")}
            description={t("desktop.closeTrayHint")}
          /> : <p className="first-launch-desktop-capability">{t("desktop.trayUnavailable")}</p>}
          <RadioOption
            name="first-launch-close-behavior"
            value="quit"
            checked={preferences.closeBehavior === "quit"}
            onChange={() => void updatePreferences({ closeBehavior: "quit" })}
            label={t("desktop.closeQuit")}
            description={t("desktop.closeQuitHint")}
          />
        </fieldset>
      </section>

      <section className="first-launch-desktop-group" aria-labelledby="first-launch-desktop-location">
        <div className="first-launch-desktop-group-heading">
          <h3 id="first-launch-desktop-location">{t("desktop.destinationLegend")}</h3>
          <p>{t("desktop.destinationDescription")}</p>
        </div>
        <fieldset className="first-launch-desktop-options" disabled={busy !== null}>
          <legend className="sr-only">{t("desktop.destinationLegend")}</legend>
          <RadioOption name="first-launch-startup-destination" value="last" checked={preferences.startupDestination === "last"} onChange={() => void updatePreferences({ startupDestination: "last" })} label={t("desktop.destinationLast")} description={t("desktop.destinationLastHint")} />
          <RadioOption name="first-launch-startup-destination" value="feed" checked={preferences.startupDestination === "feed"} onChange={() => void updatePreferences({ startupDestination: "feed" })} label={t("desktop.destinationFeed")} description={t("desktop.destinationFeedHint")} />
          <RadioOption name="first-launch-startup-destination" value="messages" checked={preferences.startupDestination === "messages"} onChange={() => void updatePreferences({ startupDestination: "messages" })} label={t("desktop.destinationMessages")} description={t("desktop.destinationMessagesHint")} />
          <RadioOption name="first-launch-startup-destination" value="communities" checked={preferences.startupDestination === "communities"} onChange={() => void updatePreferences({ startupDestination: "communities" })} label={t("desktop.destinationCommunities")} description={t("desktop.destinationCommunitiesHint")} />
        </fieldset>
      </section>

      {error ? <p className="first-launch-desktop-error" role="alert">{error}</p> : null}
    </div>
  );
}

function RadioOption({ name, value, checked, onChange, label, description }: Readonly<{
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
}>) {
  return (
    <label className="first-launch-desktop-radio">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} />
      <span><strong>{label}</strong><small>{description}</small></span>
    </label>
  );
}
