import React from "react";
import ReactDOM from "react-dom/client";
import { DesktopStartupErrorBoundary } from "../components/DesktopStartupErrorBoundary";
import { ProductionConfigurationError } from "../components/ProductionConfigurationError";
import { localDataMigrationService } from "../services/localDataMigrationService";
import { productionRuntimeConfigService } from "../services/productionRuntimeConfigService";
import { safeModeService } from "../services/safeModeService";
import { settingsService } from "../services/settingsService";
import { WebAppRoot } from "./WebAppRoot";
import "../styles.css";
import "../screenShareQuality.css";

function markWebRuntime(): void {
  document.documentElement.dataset.runtime = "web";
  // Explicitly no companion window on web.
  delete document.documentElement.dataset.companionWindow;
}

function getRootElement(): HTMLElement {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Picom web root element was not found.");
  }
  return rootElement;
}

function registerPwaUpdatePrompt(): void {
  // vite-plugin-pwa injects virtual:pwa-register only in the web Vite config.
  void import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onNeedRefresh() {
          const shouldReload = window.confirm(
            "A new version of Picom Web is available. Reload to update?",
          );
          if (shouldReload) window.location.reload();
        },
        onOfflineReady() {
          console.info("Picom Web is ready to work offline for cached shell assets.");
        },
      });
    })
    .catch(() => {
      // Dev without PWA plugin, or register unavailable — fine.
    });
}

function bootstrapWeb(): void {
  markWebRuntime();

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
  settingsService.getSettings();

  ReactDOM.createRoot(getRootElement()).render(
    <React.StrictMode>
      <DesktopStartupErrorBoundary>
        <WebAppRoot />
      </DesktopStartupErrorBoundary>
    </React.StrictMode>,
  );

  registerPwaUpdatePrompt();
}

bootstrapWeb();
