import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { DesktopStartupErrorBoundary } from "./components/DesktopStartupErrorBoundary";
import { deepLinkService } from "./services/deepLinkService";
import "./styles.css";

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

function bootstrapRenderer(): void {
  markRuntime();
  deepLinkService.startNativeListener();

  ReactDOM.createRoot(getRootElement()).render(
    <React.StrictMode>
      <DesktopStartupErrorBoundary>
        <App />
      </DesktopStartupErrorBoundary>
    </React.StrictMode>
  );
}

bootstrapRenderer();
