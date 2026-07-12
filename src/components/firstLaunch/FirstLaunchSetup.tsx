import { useMemo, useState } from "react";
import type { ThemeMode } from "../../services/settingsService";
import { AppIcon, type IconName } from "../AppIcon";
import { firstLaunchCopy, type SetupLocale } from "./firstLaunchCopy";

type FirstLaunchSetupProps = {
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  onComplete: () => void;
};

type SetupStep = "welcome" | "theme" | "permissions" | "complete";

function PermissionCard({ icon, title, children }: { icon: IconName; title: string; children: string }) {
  return <article className="first-launch-info-card"><span><AppIcon name={icon} size="lg" /></span><div><strong>{title}</strong><p>{children}</p></div></article>;
}

export function FirstLaunchSetup({ theme, onThemeChange, onComplete }: FirstLaunchSetupProps) {
  const [locale, setLocale] = useState<SetupLocale>(() => typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("tr") ? "tr" : "en");
  const [stepIndex, setStepIndex] = useState(0);
  const copy = firstLaunchCopy[locale];
  const steps: ReadonlyArray<{ id: SetupStep; label: string; icon: IconName }> = useMemo(() => [
    { id: "welcome", label: copy.steps.welcome, icon: "home" },
    { id: "theme", label: copy.steps.theme, icon: "sun" },
    { id: "permissions", label: copy.steps.permissions, icon: "lock" },
    { id: "complete", label: copy.steps.complete, icon: "send" },
  ], [copy]);
  const current = steps[stepIndex];
  const progress = useMemo(() => Math.round(((stepIndex + 1) / steps.length) * 100), [stepIndex]);
  const next = () => setStepIndex((index) => Math.min(steps.length - 1, index + 1));

  return (
    <main className="first-launch-setup" aria-label={copy.setupLabel}>
      <section className="first-launch-frame" aria-live="polite">
        <aside className="first-launch-rail">
          <div className="first-launch-brand"><span className="first-launch-brand-mark">P</span><div><strong>Picom</strong><small>{copy.desktopSetup}</small></div></div>
          <ol>{steps.map((step, index) => <li key={step.id} className={`${index === stepIndex ? "active" : ""} ${index < stepIndex ? "complete" : ""}`}><span>{index < stepIndex ? "OK" : index + 1}</span><div><strong>{step.label}</strong><small>{index === stepIndex ? copy.currentStep : index < stepIndex ? copy.completedStep : copy.upcomingStep}</small></div></li>)}</ol>
          <div className="first-launch-progress"><span style={{ width: `${progress}%` }} /><small>{progress}% {copy.ready}</small></div>
        </aside>

        <div className="first-launch-content">
          <div className="first-launch-locale-toggle" aria-label={copy.languageLabel}><button type="button" className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>English</button><button type="button" className={locale === "tr" ? "active" : ""} onClick={() => setLocale("tr")}>Türkçe</button></div>
          {current.id === "welcome" ? <div className="first-launch-step"><p className="eyebrow">{copy.welcome.eyebrow}</p><h1>{copy.welcome.title}</h1><p>{copy.welcome.body}</p><div className="first-launch-hero" aria-hidden="true"><span><AppIcon name="users" size="xl" /></span><i /><i /></div></div> : null}

          {current.id === "theme" ? <div className="first-launch-step"><p className="eyebrow">{copy.theme.eyebrow}</p><h1>{copy.theme.title}</h1><p>{copy.theme.body}</p><div className="first-launch-theme-grid"><button type="button" className={theme === "light" ? "selected" : ""} onClick={() => onThemeChange("light")}><span className="theme-preview light"><AppIcon name="sun" size="xl" /></span><strong>{copy.theme.light}</strong><small>{copy.theme.lightHint}</small></button><button type="button" className={theme === "dark" ? "selected" : ""} onClick={() => onThemeChange("dark")}><span className="theme-preview dark"><AppIcon name="moon" size="xl" /></span><strong>{copy.theme.dark}</strong><small>{copy.theme.darkHint}</small></button></div></div> : null}

          {current.id === "permissions" ? <div className="first-launch-step"><p className="eyebrow">{copy.permissions.eyebrow}</p><h1>{copy.permissions.title}</h1><p>{copy.permissions.body}</p><div className="first-launch-card-grid"><PermissionCard icon="bell" title={copy.permissions.notifications}>{copy.permissions.notificationsBody}</PermissionCard></div></div> : null}

          {current.id === "complete" ? <div className="first-launch-step first-launch-complete"><span className="first-launch-complete-mark"><AppIcon name="send" size="xl" /></span><p className="eyebrow">{copy.finish.eyebrow}</p><h1>{copy.finish.title}</h1><p>{copy.finish.body}</p></div> : null}

          <footer className="first-launch-actions"><button type="button" className="secondary" disabled={stepIndex === 0} onClick={() => setStepIndex((index) => Math.max(0, index - 1))}>{copy.actions.back}</button>{current.id === "permissions" ? <button type="button" className="secondary" onClick={() => setStepIndex(steps.length - 1)}>{copy.actions.later}</button> : null}{current.id === "complete" ? <button type="button" className="primary" onClick={onComplete}>{copy.actions.continueToPicom} <AppIcon name="chevronRight" size="sm" /></button> : <button type="button" className="primary" onClick={next}>{copy.actions.continue} <AppIcon name="chevronRight" size="sm" /></button>}</footer>
        </div>
      </section>
    </main>
  );
}
