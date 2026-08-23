import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { DesktopStartupErrorBoundary } from "./components/DesktopStartupErrorBoundary";
import { CompanionApp } from "./features/companion/CompanionApp";
import { isCompanionWindowSearch } from "./features/companion/companionTypes";
import { deepLinkService } from "./services/deepLinkService";
import { safeModeService } from "./services/safeModeService";
import { crashReporterService } from "./services/crashReporterService";
import { localDataMigrationService } from "./services/localDataMigrationService";
import { productionRuntimeConfigService } from "./services/productionRuntimeConfigService";
import { settingsService } from "./services/settingsService";
import { profileMediaRealtimeService } from "./services/profileMedia/profileMediaRealtimeService";
import { ProductionConfigurationError } from "./components/ProductionConfigurationError";
import "./styles.css";
import "./screenShareQuality.css";

function markRuntime(): void {
  const runtimeInfo = window.picomDesktop?.getRuntimeInfo();

  if (!runtimeInfo) {
    document.documentElement.dataset.runtime = "browser";
  } else {
    document.documentElement.dataset.runtime = runtimeInfo.runtime;
    document.documentElement.dataset.platform = runtimeInfo.platform;
  }

  if (isCompanionWindowSearch()) {
    document.documentElement.dataset.companionWindow = "true";
  }
}

function getRootElement(): HTMLElement {
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error("Picom renderer root element was not found.");
  }

  return rootElement;
}

type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};

function scheduleOptionalRendererServices(safeModeActive: boolean): void {
  const start = () => {
    if (safeModeActive) return;
    crashReporterService.initialize();
    void profileMediaRealtimeService.start();
    void import("./services/sleepWakeResumeService").then((sleepWakeModule) => {
      sleepWakeModule.sleepWakeResumeService.start();
    }).catch(() => {
      console.warn("Optional renderer services could not start; the desktop shell remains available.");
    });
  };

  const idleWindow = window as IdleWindow;
  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(start, { timeout: 1_200 });
    return;
  }

  window.setTimeout(start, 0);
}

/** Switches between main desktop App and Electron Companion windows (`?picomWindow=companion`). */
function DesktopRendererRoot() {
  const [companionWindow, setCompanionWindow] = useState(() => isCompanionWindowSearch());

  useEffect(() => {
    const sync = () => {
      const next = isCompanionWindowSearch();
      setCompanionWindow(next);
      if (next) document.documentElement.dataset.companionWindow = "true";
      else delete document.documentElement.dataset.companionWindow;
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  return companionWindow ? <CompanionApp /> : <App />;
}

function bootstrapRenderer(): void {
  markRuntime();
  const productionConfiguration = productionRuntimeConfigService.getConfiguration();
  if (!productionConfiguration.ready) {
    ReactDOM.createRoot(getRootElement()).render(
      <React.StrictMode>
        <DesktopStartupErrorBoundary>
          <ProductionConfigurationError configuration={productionConfiguration} />
        </DesktopStartupErrorBoundary>
      </React.StrictMode>,
    );
    return;
  }
  const migration = localDataMigrationService.migrateOnStartup();
  if (!migration.ok) safeModeService.enableSafeMode("local_data_migration_failed");
  // Warm settings so corrupted local JSON can flip Safe Mode before optional services start.
  settingsService.getSettings();
  const safeMode = safeModeService.getStartupState();
  const companionWindow = isCompanionWindowSearch();

  // Companion windows are dedicated shells; deep links belong on the main window.
  if (!safeMode.active && !companionWindow) {
    deepLinkService.startNativeListener();
  }

  ReactDOM.createRoot(getRootElement()).render(
    <React.StrictMode>
      <DesktopStartupErrorBoundary>
        <DesktopRendererRoot />
      </DesktopStartupErrorBoundary>
    </React.StrictMode>
  );

  scheduleOptionalRendererServices(safeMode.active);
}

bootstrapRenderer();
