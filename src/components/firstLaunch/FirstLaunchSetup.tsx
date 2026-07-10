import { useMemo, useState } from "react";
import type { ThemeMode } from "../../services/settingsService";
import { AppIcon, type IconName } from "../AppIcon";

type FirstLaunchSetupProps = {
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  onComplete: () => void;
};

type SetupStep = "welcome" | "theme" | "permissions" | "voice" | "complete";

const steps: ReadonlyArray<{ id: SetupStep; label: string; icon: IconName }> = [
  { id: "welcome", label: "Welcome", icon: "home" },
  { id: "theme", label: "Appearance", icon: "sun" },
  { id: "permissions", label: "Permissions", icon: "lock" },
  { id: "voice", label: "Voice and sharing", icon: "microphone" },
  { id: "complete", label: "Ready", icon: "send" },
];

function PermissionCard({ icon, title, children }: { icon: IconName; title: string; children: string }) {
  return <article className="first-launch-info-card"><span><AppIcon name={icon} size="lg" /></span><div><strong>{title}</strong><p>{children}</p></div></article>;
}

export function FirstLaunchSetup({ theme, onThemeChange, onComplete }: FirstLaunchSetupProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [permissionGuideOpen, setPermissionGuideOpen] = useState(false);
  const current = steps[stepIndex];
  const progress = useMemo(() => Math.round(((stepIndex + 1) / steps.length) * 100), [stepIndex]);
  const next = () => setStepIndex((index) => Math.min(steps.length - 1, index + 1));

  return (
    <main className="first-launch-setup" aria-label="Picom first launch setup">
      <section className="first-launch-frame" aria-live="polite">
        <aside className="first-launch-rail">
          <div className="first-launch-brand"><span className="first-launch-brand-mark">P</span><div><strong>Picom</strong><small>Desktop setup</small></div></div>
          <ol>{steps.map((step, index) => <li key={step.id} className={`${index === stepIndex ? "active" : ""} ${index < stepIndex ? "complete" : ""}`}><span>{index < stepIndex ? "OK" : index + 1}</span><div><strong>{step.label}</strong><small>{index === stepIndex ? "Current step" : index < stepIndex ? "Complete" : "Upcoming"}</small></div></li>)}</ol>
          <div className="first-launch-progress"><span style={{ width: `${progress}%` }} /><small>{progress}% ready</small></div>
        </aside>

        <div className="first-launch-content">
          {current.id === "welcome" ? <div className="first-launch-step"><p className="eyebrow">Welcome to Picom</p><h1>Your desktop community workspace</h1><p>Set a comfortable theme and review how Picom uses desktop permissions. This takes less than a minute.</p><div className="first-launch-hero" aria-hidden="true"><span><AppIcon name="users" size="xl" /></span><i /><i /></div></div> : null}

          {current.id === "theme" ? <div className="first-launch-step"><p className="eyebrow">Appearance</p><h1>Choose your starting theme</h1><p>The selection applies immediately and can be changed later in Settings.</p><div className="first-launch-theme-grid"><button type="button" className={theme === "light" ? "selected" : ""} onClick={() => onThemeChange("light")}><span className="theme-preview light"><AppIcon name="sun" size="xl" /></span><strong>Light</strong><small>Soft cool surfaces</small></button><button type="button" className={theme === "dark" ? "selected" : ""} onClick={() => onThemeChange("dark")}><span className="theme-preview dark"><AppIcon name="moon" size="xl" /></span><strong>Dark</strong><small>Calm charcoal surfaces</small></button></div></div> : null}

          {current.id === "permissions" ? <div className="first-launch-step"><p className="eyebrow">Your control</p><h1>Permissions are requested only when needed</h1><p>Setup explains permissions but never opens a system prompt. You can continue now and decide separately when each feature is used.</p><div className="first-launch-card-grid"><PermissionCard icon="bell" title="Notifications">Requested later from notification settings or after a relevant in-app prompt, never at startup.</PermissionCard><PermissionCard icon="microphone" title="Microphone">Requested only when you join voice and choose to use your microphone.</PermissionCard><PermissionCard icon="image" title="Screen sharing">The source picker and system permission appear only after you start screen sharing.</PermissionCard></div>{permissionGuideOpen ? <section className="first-launch-permission-guide" aria-label="Desktop permission guide"><header><AppIcon name="lock" size="md" /><div><strong>Platform permission guide</strong><small>Picom does not open these settings during setup.</small></div></header><div><article><strong>Windows</strong><p>Review microphone access under Privacy & security. Screen capture source selection appears only when sharing.</p></article><article><strong>macOS</strong><p>Microphone and Screen & System Audio Recording access are managed in the Privacy & Security area of System Settings. Restarting Picom may be required after a change.</p></article><article><strong>Linux</strong><p>Desktop portals and audio permissions vary by distribution, Wayland/X11 session, and package format. Grant only the source or device you intend to use.</p></article></div></section> : null}</div> : null}

          {current.id === "voice" ? <div className="first-launch-step"><p className="eyebrow">Voice and sharing</p><h1>Nothing starts without your action</h1><p>Joining a voice room, selecting a microphone, and choosing a screen or window are separate explicit actions.</p><div className="first-launch-card-grid"><PermissionCard icon="voice" title="Voice rooms">Join and leave from a channel. Mute and deafen remain under your control.</PermissionCard><PermissionCard icon="microphone" title="Device access">Picom waits until a voice action before requesting microphone access.</PermissionCard><PermissionCard icon="image" title="Screen source">Picom never captures the desktop automatically during startup or setup.</PermissionCard></div><div className="first-launch-safety-note"><AppIcon name="lock" size="sm" /><span>You can review platform permission guidance from Settings at any time.</span></div></div> : null}

          {current.id === "complete" ? <div className="first-launch-step first-launch-complete"><span className="first-launch-complete-mark"><AppIcon name="send" size="xl" /></span><p className="eyebrow">Setup complete</p><h1>Picom is ready</h1><p>Continue to sign in or create an account. Account onboarding will stay separate and guide your profile and communities.</p></div> : null}

          <footer className="first-launch-actions"><button type="button" className="secondary" disabled={stepIndex === 0} onClick={() => setStepIndex((index) => Math.max(0, index - 1))}>Back</button>{current.id === "permissions" || current.id === "voice" ? <button type="button" className="secondary" onClick={() => setStepIndex(steps.length - 1)}>Set up later</button> : null}{current.id === "permissions" ? <button type="button" className="secondary" aria-expanded={permissionGuideOpen} onClick={() => setPermissionGuideOpen((open) => !open)}>{permissionGuideOpen ? "Hide permission guide" : "View permission guide"}</button> : null}{current.id === "complete" ? <button type="button" className="primary" onClick={onComplete}>Continue to Picom <AppIcon name="chevronRight" size="sm" /></button> : <button type="button" className="primary" onClick={next}>Continue <AppIcon name="chevronRight" size="sm" /></button>}</footer>
        </div>
      </section>
    </main>
  );
}
