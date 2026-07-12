import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { DesktopStartupErrorBoundary } from "./components/DesktopStartupErrorBoundary";
import { deepLinkService } from "./services/deepLinkService";
import { safeModeService } from "./services/safeModeService";
import { crashReporterService } from "./services/crashReporterService";
import { localDataMigrationService } from "./services/localDataMigrationService";
import { productionRuntimeConfigService } from "./services/productionRuntimeConfigService";
import { ProductionConfigurationError } from "./components/ProductionConfigurationError";
import "./styles.css";
import "./screenShareQuality.css";

function markRuntime(): void {
  const runtimeInfo = window.picomDesktop?.getRuntimeInfo();

  if (!runtimeInfo) {
    document.documentElement.dataset.runtime = "browser";
    return;
  }

  document.documentElement.dataset.runtime = runtimeInfo.runtime;
  document.documentElement.dataset.platform = runtimeInfo.platform;
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
  const safeMode = safeModeService.getStartupState();

  if (!safeMode.active) {
    deepLinkService.startNativeListener();
  }

  ReactDOM.createRoot(getRootElement()).render(
    <React.StrictMode>
      <DesktopStartupErrorBoundary>
        <App />
      </DesktopStartupErrorBoundary>
    </React.StrictMode>
  );

  scheduleOptionalRendererServices(safeMode.active);
}

bootstrapRenderer();
