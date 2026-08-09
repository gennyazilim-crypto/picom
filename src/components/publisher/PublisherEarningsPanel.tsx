import { useEffect, useState } from "react";
import { localizationService } from "../../services/localizationService";
import {
  formatMinorUnits,
  publisherMonetizationService,
  type PublisherEarningsOverview,
  type PublisherFinanceTransaction,
} from "../../services/live/publisherMonetizationService";
import { featureFlagService } from "../../services/featureFlagService";
import { translatePublisherMonetization } from "../../services/localization/publisherMonetizationCatalog";

type SubSection = "overview" | "setup" | "subscriptions" | "donations" | "ads" | "payouts" | "statements" | "transactions";

function t(key: string): string {
  return translatePublisherMonetization(key, localizationService.getLanguage());
}

export function PublisherEarningsPanel() {
  const enabled = featureFlagService.isEnabled("enablePublisherEarningsDashboard");
  const locale = localizationService.getLanguage();
  const [section, setSection] = useState<SubSection>("overview");
  const [overview, setOverview] = useState<PublisherEarningsOverview | null>(null);
  const [transactions, setTransactions] = useState<ReadonlyArray<PublisherFinanceTransaction>>([]);
  const [setup, setSetup] = useState<Record<string, unknown> | null>(null);
  const [payoutRequests, setPayoutRequests] = useState<ReadonlyArray<Record<string, unknown>>>([]);
  const [statements, setStatements] = useState<ReadonlyArray<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState("");
  const kycEnabled = featureFlagService.isEnabled("enablePublisherKyc");
  const payoutsUiEnabled = featureFlagService.isEnabled("enablePublisherPayouts");
  const statementsEnabled = featureFlagService.isEnabled("enablePublisherStatements");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const result = await publisherMonetizationService.getEarningsOverview();
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOverview(result.data);
      setError(null);
      const setupResult = await publisherMonetizationService.getFinanceSetup();
      if (!cancelled && setupResult.ok) setSetup(setupResult.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || section !== "payouts" || !payoutsUiEnabled) return;
    let cancelled = false;
    void (async () => {
      const result = await publisherMonetizationService.getPayoutRequests();
      if (cancelled) return;
      if (result.ok) setPayoutRequests(result.items as Record<string, unknown>[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, section, payoutsUiEnabled]);

  useEffect(() => {
    if (!enabled || section !== "statements" || !statementsEnabled) return;
    let cancelled = false;
    void (async () => {
      const result = await publisherMonetizationService.getStatements();
      if (cancelled) return;
      if (result.ok) setStatements(result.items as Record<string, unknown>[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, section, statementsEnabled]);

  useEffect(() => {
    if (!enabled || section !== "transactions") return;
    let cancelled = false;
    void (async () => {
      const result = await publisherMonetizationService.getTransactions({
        limit: 40,
        sourceType: sourceFilter || undefined,
      });
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTransactions(result.items);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, section, sourceFilter]);

  if (!enabled) {
    return (
      <div className="publisher-card" role="status">
        <h2>{t("earnings.title")}</h2>
        <p>{t("earnings.monetizationUnavailable")}</p>
      </div>
    );
  }

  const balances = overview?.balances_by_currency ?? [];

  return (
    <section className="publisher-card" aria-label={t("earnings.aria")}>
      <header>
        <h2>{t("earnings.title")}</h2>
        <p role="status">{t("earnings.payoutsUnavailable")}</p>
        <p>{t("earnings.payoutSetupUnavailable")}</p>
      </header>

      <nav className="publisher-tabs" aria-label={t("earnings.title")}>
        {(
          [
            ["overview", "earnings.overview"],
            ["setup", "finance.setup"],
            ["subscriptions", "earnings.subscriptions"],
            ["donations", "earnings.donations"],
            ["ads", "earnings.adRevenue"],
            ["payouts", "finance.payouts"],
            ["statements", "finance.statements"],
            ["transactions", "earnings.transactions"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={section === key ? "is-active" : ""}
            onClick={() => setSection(key)}
          >
            {t(label)}
          </button>
        ))}
      </nav>

      {error ? <p className="publisher-error" role="alert">{error}</p> : null}

      {section === "overview" ? (
        <div>
          <h3>{t("earnings.revenueBreakdown")}</h3>
          {balances.length === 0 ? <p>{t("earnings.empty")}</p> : null}
          <table aria-label={t("earnings.tableFallback")}>
            <thead>
              <tr>
                <th scope="col">{t("earnings.currency")}</th>
                <th scope="col">{t("earnings.pendingBalance")}</th>
                <th scope="col">{t("earnings.availableBalance")}</th>
                <th scope="col">{t("earnings.paidOut")}</th>
                <th scope="col">{t("earnings.grossRevenue")}</th>
                <th scope="col">{t("earnings.netRevenue")}</th>
                <th scope="col">{t("earnings.refund")}</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((row) => (
                <tr key={row.currency}>
                  <td>{row.currency}</td>
                  <td>
                    <span aria-label={`${t("earnings.pendingBalance")} ${row.currency}`}>
                      {formatMinorUnits(row.pending_balance_minor, row.currency, locale)}
                    </span>
                  </td>
                  <td>
                    <span aria-label={`${t("earnings.availableBalance")} ${row.currency}`}>
                      {formatMinorUnits(row.available_balance_minor, row.currency, locale)}
                    </span>
                  </td>
                  <td>
                    <span aria-label={`${t("earnings.paidOut")} ${row.currency}`}>
                      {formatMinorUnits(row.paid_balance_minor, row.currency, locale)}
                    </span>
                    <span> — {t("earnings.payoutsUnavailable")}</span>
                  </td>
                  <td>{formatMinorUnits(row.gross_revenue_minor, row.currency, locale)}</td>
                  <td>{formatMinorUnits(row.net_revenue_minor, row.currency, locale)}</td>
                  <td>
                    <span aria-label={`${t("earnings.refund")} / ${t("earnings.chargeback")}`}>
                      {formatMinorUnits(Math.abs(row.refunded_or_reversed_minor), row.currency, locale)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul aria-label={t("earnings.revenueBreakdown")}>
            {balances.map((row) => (
              <li key={`${row.currency}-break`}>
                {row.currency}: {t("earnings.subscriptions")}{" "}
                {formatMinorUnits(row.subscriptions_net_minor, row.currency, locale)};{" "}
                {t("earnings.donations")} {formatMinorUnits(row.donations_net_minor, row.currency, locale)};{" "}
                {t("earnings.adRevenue")} {formatMinorUnits(row.ads_net_minor, row.currency, locale)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {section === "setup" ? (
        <div>
          <h3>{t("finance.financeSetup")}</h3>
          <ul aria-label={t("finance.financeSetup")}>
            <li>
              {t("finance.identityVerification")}: {String(setup?.kyc_status ?? t("finance.notStarted"))}
            </li>
            <li>
              {t("finance.taxProfile")}: {String(setup?.tax_status ?? t("finance.notStarted"))}
            </li>
            <li>
              {t("finance.payoutAccount")}: {String(setup?.payout_account_status ?? "NONE")}
            </li>
            <li>
              {t("finance.payoutOnHold")}: {setup?.payout_hold_active ? t("finance.payoutOnHold") : "—"}
            </li>
            <li role="status">{t("finance.providerUnavailable")}</li>
          </ul>
          {kycEnabled ? (
            <button
              type="button"
              className="publisher-primary"
              onClick={() => {
                void publisherMonetizationService.requestKycOnboarding().then((result) => {
                  if (!result.ok) setError(result.error);
                });
              }}
            >
              {t("finance.identityVerification")}
            </button>
          ) : null}
        </div>
      ) : null}

      {section === "subscriptions" ? (
        <div>
          <h3>{t("earnings.subscriptions")}</h3>
          <p>{t("earnings.monetizationUnavailable")}</p>
          <p>{t("earnings.subscriptionTier")}: {t("earnings.monthly")} / {t("earnings.yearly")}</p>
        </div>
      ) : null}

      {section === "donations" ? (
        <div>
          <h3>{t("earnings.donations")}</h3>
          <p>{t("earnings.tips")}</p>
          <p>{t("earnings.monetizationUnavailable")}</p>
        </div>
      ) : null}

      {section === "ads" ? (
        <div>
          <h3>{t("earnings.adRevenue")}</h3>
          <p>{t("earnings.monetizationUnavailable")}</p>
        </div>
      ) : null}

      {section === "payouts" ? (
        <div>
          <h3>{t("finance.payouts")}</h3>
          <p role="status">{t("finance.payoutUnavailable")}</p>
          {!payoutsUiEnabled ? <p>{t("earnings.monetizationUnavailable")}</p> : null}
          {setup?.payout_hold_active ? <p role="status">{t("finance.payoutOnHold")}</p> : null}
          <table aria-label={t("finance.payouts")}>
            <thead>
              <tr>
                <th scope="col">{t("earnings.date")}</th>
                <th scope="col">{t("earnings.net")}</th>
                <th scope="col">{t("earnings.currency")}</th>
                <th scope="col">{t("earnings.status")}</th>
              </tr>
            </thead>
            <tbody>
              {payoutRequests.map((row) => (
                <tr key={String(row.id)}>
                  <td>{row.requested_at ? new Date(String(row.requested_at)).toLocaleString(locale) : "—"}</td>
                  <td>
                    {formatMinorUnits(Number(row.requested_amount_minor ?? 0), String(row.currency ?? "EUR"), locale)}
                  </td>
                  <td>{String(row.currency ?? "")}</td>
                  <td>{String(row.status ?? "")}</td>
                </tr>
              ))}
              {payoutRequests.length === 0 ? (
                <tr>
                  <td colSpan={4}>{t("earnings.empty")}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {section === "statements" ? (
        <div>
          <h3>{t("finance.statements")}</h3>
          {!statementsEnabled ? <p>{t("earnings.monetizationUnavailable")}</p> : null}
          <table aria-label={t("finance.earningsStatement")}>
            <thead>
              <tr>
                <th scope="col">{t("earnings.date")}</th>
                <th scope="col">{t("earnings.currency")}</th>
                <th scope="col">{t("earnings.grossRevenue")}</th>
                <th scope="col">{t("earnings.netRevenue")}</th>
                <th scope="col">{t("finance.payouts")}</th>
                <th scope="col">{t("earnings.availableBalance")}</th>
              </tr>
            </thead>
            <tbody>
              {statements.map((row) => (
                <tr key={String(row.id)}>
                  <td>
                    {row.period_start ? new Date(String(row.period_start)).toLocaleDateString(locale) : "—"}
                    {" – "}
                    {row.period_end ? new Date(String(row.period_end)).toLocaleDateString(locale) : "—"}
                  </td>
                  <td>{String(row.currency ?? "")}</td>
                  <td>{formatMinorUnits(Number(row.gross_revenue_minor ?? 0), String(row.currency ?? "EUR"), locale)}</td>
                  <td>{formatMinorUnits(Number(row.net_revenue_minor ?? 0), String(row.currency ?? "EUR"), locale)}</td>
                  <td>{formatMinorUnits(Number(row.payouts_minor ?? 0), String(row.currency ?? "EUR"), locale)}</td>
                  <td>
                    {formatMinorUnits(
                      Number(row.ending_available_balance_minor ?? 0),
                      String(row.currency ?? "EUR"),
                      locale,
                    )}
                  </td>
                </tr>
              ))}
              {statements.length === 0 ? (
                <tr>
                  <td colSpan={6}>{t("earnings.empty")}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {section === "transactions" ? (
        <div>
          <h3>{t("earnings.transactions")}</h3>
          <div role="group" aria-label={t("earnings.filters")}>
            <label>
              {t("earnings.source")}
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                <option value="">—</option>
                <option value="subscription">{t("earnings.subscriptions")}</option>
                <option value="donation">{t("earnings.donations")}</option>
                <option value="ad_revenue">{t("earnings.adRevenue")}</option>
                <option value="refund">{t("earnings.refund")}</option>
                <option value="chargeback">{t("earnings.chargeback")}</option>
              </select>
            </label>
          </div>
          <table aria-label={t("earnings.transactions")}>
            <thead>
              <tr>
                <th scope="col">{t("earnings.date")}</th>
                <th scope="col">{t("earnings.source")}</th>
                <th scope="col">{t("earnings.net")}</th>
                <th scope="col">{t("earnings.currency")}</th>
                <th scope="col">{t("earnings.status")}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{new Date(tx.created_at).toLocaleString(locale)}</td>
                  <td>{tx.source_type}</td>
                  <td>
                    <span>
                      {tx.direction === "debit" ? "−" : "+"}
                      {formatMinorUnits(tx.amount_minor, tx.currency, locale)}
                    </span>
                  </td>
                  <td>{tx.currency}</td>
                  <td>{tx.balance_bucket}</td>
                </tr>
              ))}
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5}>{t("earnings.empty")}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
