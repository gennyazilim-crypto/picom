import { useCallback, useEffect, useState } from "react";
import { SocialProviderLogo } from "../../components/auth/SocialProviderLogo";
import {
  getSocialAuthProviderLabel,
  socialAuthService,
  type SocialAuthProvider,
  type SocialProviderAccountState,
} from "../../services/auth/socialAuthService";
import { FormStatus } from "../components/FormStatus";
import { AccountCard, StatusBadge } from "../components/ui";
import { t } from "../i18n/messages";

const DISPLAY_PROVIDERS: readonly SocialAuthProvider[] = ["google", "steam", "epic"];

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function ConnectionsPage() {
  const [states, setStates] = useState<SocialProviderAccountState[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<SocialAuthProvider | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await socialAuthService.getAccountProviderStates();
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      setStates([]);
      return;
    }
    setError(null);
    setStates(result.data.filter((row) => DISPLAY_PROVIDERS.includes(row.provider)));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = async (provider: SocialAuthProvider) => {
    setBusy(provider);
    setMessage(null);
    setError(null);
    const result = await socialAuthService.beginProviderLink(provider);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.data.message);
    await refresh();
  };

  const disconnect = async (provider: SocialAuthProvider) => {
    const label = getSocialAuthProviderLabel(provider);
    if (!window.confirm(t("connections.confirmUnlink").replace("{provider}", label))) return;
    setBusy(provider);
    setMessage(null);
    setError(null);
    const result = await socialAuthService.unlinkProvider(provider);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.data.message);
    await refresh();
  };

  return (
    <section className="ac-page ac-page--narrow">
      <AccountCard>
        <div className="ac-page-header__row">
          <div>
            <h2 className="ac-surface-card__title">{t("connections.title")}</h2>
            <p className="ac-muted">{t("connections.subtitle")}</p>
          </div>
        </div>

        {loading ? <FormStatus tone="loading" message={t("common.loading")} /> : null}
        {error ? <FormStatus tone="error" message={error} /> : null}
        {message ? <FormStatus tone="success" message={message} /> : null}

        <ul className="ac-connections-list" aria-label={t("connections.title")}>
          {states.map((state) => {
            const label = state.label;
            const isBusy = busy === state.provider;
            return (
              <li key={state.provider} className="ac-connections-item">
                <div className="ac-connections-item__identity">
                  <span className="ac-connections-item__logo" aria-hidden="true">
                    <SocialProviderLogo provider={state.provider} size={22} />
                  </span>
                  <div>
                    <strong>{label}</strong>
                    <p className="ac-muted">
                      {state.linked
                        ? t("connections.linkedMeta")
                          .replace("{linked}", formatDate(state.linkedAt))
                          .replace("{used}", formatDate(state.lastUsedAt))
                        : state.reason ?? t("connections.notConnected")}
                    </p>
                  </div>
                </div>
                <div className="ac-connections-item__actions">
                  <StatusBadge tone={state.linked ? "success" : "neutral"}>
                    {state.linked ? t("connections.connected") : t("connections.notConnected")}
                  </StatusBadge>
                  {state.linked ? (
                    <button
                      type="button"
                      className="ac-btn ac-btn--ghost"
                      disabled={isBusy || busy !== null}
                      onClick={() => void disconnect(state.provider)}
                    >
                      {isBusy ? t("connections.working") : t("connections.disconnect")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ac-btn"
                      disabled={!state.available || isBusy || busy !== null}
                      onClick={() => void connect(state.provider)}
                    >
                      {isBusy ? t("connections.working") : t("connections.connect")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="ac-muted" style={{ marginTop: "1rem" }}>
          {t("connections.footer")}
        </p>
      </AccountCard>
    </section>
  );
}
