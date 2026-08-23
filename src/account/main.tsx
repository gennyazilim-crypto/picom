import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { MarketingConsentBoundary } from "../components/marketing/MarketingConsentBoundary";
import { t } from "./i18n/messages";
import { bindSupabaseClient } from "../services/supabase/supabaseClient";
import { getAccountSupabase } from "./lib/supabase";
import "./styles/account.css";
import "./styles/profile-media-bridge.css";
import "./styles/verified.css";
import "../components/marketing/marketingConsent.css";

type AccountRoot = ReturnType<typeof ReactDOM.createRoot>;

declare global {
  interface Window {
    __PICOM_ACCOUNT_ROOT__?: AccountRoot;
  }
}

function getRootElement(): HTMLElement {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Picom Account root element was not found.");
  }
  return rootElement;
}

function ConfigError({ message }: { message: string }) {
  return (
    <div className="ac-public">
      <main className="ac-public__main">
        <div className="ac-card">
          <div className="ac-status ac-status--error" role="alert">
            {message}
          </div>
        </div>
      </main>
    </div>
  );
}

function getOrCreateRoot(): AccountRoot {
  if (!window.__PICOM_ACCOUNT_ROOT__) {
    window.__PICOM_ACCOUNT_ROOT__ = ReactDOM.createRoot(getRootElement());
  }
  return window.__PICOM_ACCOUNT_ROOT__;
}

function bootstrapAccount(): void {
  document.documentElement.dataset.runtime = "account";
  if (!document.documentElement.dataset.theme) {
    document.documentElement.dataset.theme = "dark";
  }

  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  const root = getOrCreateRoot();

  if (!url || !anonKey) {
    root.render(
      <React.StrictMode>
        <ConfigError message={t("config.missing")} />
      </React.StrictMode>,
    );
    return;
  }

  // Profile media upload/resolve must use the Account Center auth session.
  bindSupabaseClient(getAccountSupabase());

  root.render(
    <React.StrictMode>
      <MarketingConsentBoundary>
        <App />
      </MarketingConsentBoundary>
    </React.StrictMode>,
  );
}

bootstrapAccount();
