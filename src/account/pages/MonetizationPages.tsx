import { FormEvent, useEffect, useState } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { useAuth } from "../lib/session";
import { monetizationService } from "../../services/monetization/monetizationService";
import { formatMinorAsAccessible } from "../../services/monetization/payoutDomain";
import { ROUTES } from "../routes";

type ProgramType = "creator" | "publisher";

function programFromPath(): ProgramType {
  return window.location.pathname.includes("/publisher/") ? "publisher" : "creator";
}

function MonetizationNav({ program }: Readonly<{ program: ProgramType }>) {
  const base = program === "creator" ? "/creator/monetization" : "/publisher/monetization";
  return (
    <nav className="ac-subnav" aria-label={`${program} monetization`}>
      <Link to={base}>Overview</Link>
      <Link to={`${base}/onboarding`}>Onboarding</Link>
      <Link to={`${base}/earnings`}>Earnings</Link>
      <Link to={`${base}/payouts`}>Payouts</Link>
      <Link to={`${base}/tax`}>Tax</Link>
      <Link to={`${base}/agreements`}>Agreements</Link>
    </nav>
  );
}

export function MonetizationShell() {
  const program = programFromPath();
  return (
    <section className="ac-card">
      <h1>{program === "creator" ? "Creator" : "Publisher"} monetization</h1>
      <p>
        Badge eligibility is separate from monetization approval, and monetization approval is separate from payout eligibility.
        Balances are server-computed. Bank and tax forms are provider-hosted or private — never entered as fake client balances.
      </p>
      <MonetizationNav program={program} />
      <Outlet />
    </section>
  );
}

export function MonetizationOverviewPage() {
  const program = programFromPath();
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void monetizationService.getMonetizationStatus(program).then((result) => {
      if (!result.ok) setError(result.error.message);
      else setStatus(result.data);
    });
  }, [program]);

  async function startApplication() {
    setBusy(true);
    setError(null);
    const result = await monetizationService.createApplication(program, `apply:${program}:${crypto.randomUUID()}`);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    const submit = await monetizationService.submitApplication(result.data);
    if (!submit.ok) setError(submit.error.message);
    else {
      const refreshed = await monetizationService.getMonetizationStatus(program);
      if (refreshed.ok) setStatus(refreshed.data);
    }
  }

  return (
    <div>
      <h2>Program status</h2>
      {error ? <p className="ac-error" role="alert">{error}</p> : null}
      {status ? (
        <dl>
          <dt>Badge</dt><dd>{String(status.badge_status)}</dd>
          <dt>Monetization</dt><dd>{String(status.monetization_status)}</dd>
          <dt>Application</dt><dd>{String(status.application_status)}</dd>
          <dt>Compliance</dt><dd>{String(status.compliance_status)}</dd>
          <dt>Payout onboarding</dt><dd>{String(status.payout_onboarding_status)}</dd>
        </dl>
      ) : <p>Loading status…</p>}
      <button className="ac-button" type="button" disabled={busy} onClick={() => void startApplication()}>
        {busy ? "Submitting…" : "Start / submit monetization application"}
      </button>
      <p className="ac-hint">Requires an active {program} badge. Approval does not enable payouts.</p>
    </div>
  );
}

export function MonetizationOnboardingPage() {
  const { user } = useAuth();
  const program = programFromPath();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [payeeType, setPayeeType] = useState("individual");
  const [legalName, setLegalName] = useState("");
  const [countryCode, setCountryCode] = useState("DE");
  const [currency, setCurrency] = useState("EUR");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void monetizationService.getMonetizationStatus(program).then((result) => {
      if (result.ok && result.data) setAccountId(String(result.data.id));
    });
  }, [program]);

  async function onCreateProfile(event: FormEvent) {
    event.preventDefault();
    if (!accountId || !user?.id) {
      setError("Monetization account required.");
      return;
    }
    setError(null);
    const created = await monetizationService.createPayoutProfile({
      monetizationAccountId: accountId,
      payeeType,
      legalName,
      countryCode,
      payoutCurrency: currency,
    });
    if (!created.ok) {
      setError(created.error.message);
      return;
    }
    const link = await monetizationService.requestOnboardingLink(created.data);
    if (!link.ok) {
      setError(link.error.message);
      setMessage("Payout profile created. Provider onboarding is blocked until secrets are configured (fail-closed).");
      return;
    }
    window.open(link.data.url, "_blank", "noopener,noreferrer");
    setMessage("Opened provider-hosted onboarding. Return URL only refreshes status — it does not mark onboarding complete.");
  }

  return (
    <div>
      <h2>Payout onboarding</h2>
      <p>Bank details stay on the provider. PICOM stores only onboarding/capability status and masked references.</p>
      <form className="ac-form" onSubmit={onCreateProfile}>
        <label>Payee type
          <select value={payeeType} onChange={(e) => setPayeeType(e.target.value)}>
            <option value="individual">Individual</option>
            <option value="sole_trader">Sole trader</option>
            <option value="company">Company</option>
            <option value="nonprofit">Nonprofit</option>
            <option value="agency">Agency</option>
          </select>
        </label>
        <label>Legal name<input value={legalName} onChange={(e) => setLegalName(e.target.value)} required minLength={2} /></label>
        <label>Country<input value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} maxLength={2} required /></label>
        <label>Payout currency<input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} required /></label>
        {error ? <p className="ac-error" role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}
        <button className="ac-button" type="submit">Create profile &amp; open provider onboarding</button>
      </form>
    </div>
  );
}

export function MonetizationEarningsPage() {
  const program = programFromPath();
  const [currency, setCurrency] = useState("EUR");
  const [balance, setBalance] = useState<Record<string, unknown> | null>(null);
  const [eligibility, setEligibility] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const status = await monetizationService.getMonetizationStatus(program);
      if (!status.ok || !status.data) {
        setError(status.ok ? "No monetization account." : status.error.message);
        return;
      }
      const accountId = String(status.data.id);
      const bal = await monetizationService.getEarningsBalance(accountId, currency);
      if (!bal.ok) setError(bal.error.message);
      else setBalance(bal.data);
      const elig = await monetizationService.getPayoutEligibility(accountId, currency);
      if (elig.ok) setEligibility(elig.data);
    })();
  }, [program, currency]);

  return (
    <div>
      <h2>Earnings</h2>
      <label>Currency
        <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
      </label>
      {error ? <p className="ac-error" role="alert">{error}</p> : null}
      {balance ? (
        <ul>
          <li>Pending: {formatMinorAsAccessible(Number(balance.pending_minor ?? 0), currency)}</li>
          <li>Held: {formatMinorAsAccessible(Number(balance.held_minor ?? 0), currency)}</li>
          <li>Available: {formatMinorAsAccessible(Number(balance.available_minor ?? 0), currency)}</li>
          <li>Reserved for payout: {formatMinorAsAccessible(Number(balance.reserved_for_payout_minor ?? 0), currency)}</li>
          <li>Processing: {formatMinorAsAccessible(Number(balance.processing_minor ?? 0), currency)}</li>
          <li>Paid lifetime: {formatMinorAsAccessible(Number(balance.paid_lifetime_minor ?? 0), currency)}</li>
        </ul>
      ) : null}
      {eligibility ? (
        <p role="status">
          Payout eligible: {String(eligibility.eligible)}. Reason: {String(eligibility.reason_code)}.
          Next: {String(eligibility.next_required_action ?? "none")}.
        </p>
      ) : null}
    </div>
  );
}

export function MonetizationPayoutsPage() {
  const program = programFromPath();
  const [items, setItems] = useState<readonly Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const status = await monetizationService.getMonetizationStatus(program);
      if (!status.ok || !status.data) return;
      const history = await monetizationService.listPayoutHistory(String(status.data.id));
      if (!history.ok) setError(history.error.message);
      else setItems(history.data);
    })();
  }, [program]);

  return (
    <div>
      <h2>Payout history</h2>
      {error ? <p className="ac-error" role="alert">{error}</p> : null}
      <table>
        <thead>
          <tr><th scope="col">Status</th><th scope="col">Net</th><th scope="col">Currency</th><th scope="col">Message</th></tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={String(item.id)}>
              <td>{String(item.status)}</td>
              <td>{formatMinorAsAccessible(Number(item.net_amount_minor ?? 0), String(item.currency ?? "USD"))}</td>
              <td>{String(item.currency)}</td>
              <td>{String(item.failure_message_safe ?? "")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 ? <p>No payouts yet. Processing requires approved batches and provider credentials.</p> : null}
    </div>
  );
}

export function MonetizationTaxPage() {
  const program = programFromPath();
  const [payoutProfileId, setPayoutProfileId] = useState<string>("");
  const [country, setCountry] = useState("DE");
  const [entityType, setEntityType] = useState("individual");
  const [last4, setLast4] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void monetizationService.getMonetizationStatus(program).then((result) => {
      if (result.ok && result.data?.payout_profile_id) {
        setPayoutProfileId(String(result.data.payout_profile_id));
      }
    });
  }, [program]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!payoutProfileId) {
      setError("Create a payout profile before tax profile.");
      return;
    }
    const result = await monetizationService.createTaxProfile({
      payoutProfileId,
      taxResidencyCountry: country,
      taxEntityType: entityType,
      taxIdentifierLast4: last4 || null,
    });
    if (!result.ok) setError(result.error.message);
    else setMessage("Tax profile saved as pending. Verified status cannot be set by the client. TAX VERIFICATION E2E remains BLOCKED without a tax provider.");
  }

  return (
    <div>
      <h2>Tax profile</h2>
      <p>Only last4 / masked identifiers are stored for display. Full tax IDs stay tokenized/provider-managed.</p>
      <form className="ac-form" onSubmit={onSubmit}>
        <label>Residency country<input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} required /></label>
        <label>Entity type
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="individual">Individual</option>
            <option value="sole_trader">Sole trader</option>
            <option value="company">Company</option>
            <option value="nonprofit">Nonprofit</option>
          </select>
        </label>
        <label>Tax ID last4 (optional)<input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} /></label>
        {error ? <p className="ac-error" role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}
        <button className="ac-button" type="submit">Save tax profile</button>
      </form>
    </div>
  );
}

export function MonetizationAgreementsPage() {
  const program = programFromPath();
  const [docs, setDocs] = useState<readonly Record<string, unknown>[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const status = await monetizationService.getMonetizationStatus(program);
      if (status.ok && status.data) setAccountId(String(status.data.id));
      const list = await monetizationService.listAgreements(program);
      if (!list.ok) setError(list.error.message);
      else setDocs(list.data);
    })();
  }, [program]);

  async function accept(doc: Record<string, unknown>) {
    if (!accountId) return;
    const result = await monetizationService.acceptAgreement({
      monetizationAccountId: accountId,
      documentKey: String(doc.document_key),
      documentVersion: String(doc.version),
    });
    if (!result.ok) setError(result.error.message);
    else setMessage(`Accepted ${String(doc.document_key)} ${String(doc.version)}. Activation still requires LEGAL COPY active status.`);
  }

  return (
    <div>
      <h2>Agreements</h2>
      {error ? <p className="ac-error" role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      <ul>
        {docs.map((doc) => (
          <li key={String(doc.id)}>
            {String(doc.document_key)} v{String(doc.version)} — {String(doc.status)}
            <button className="ac-button ac-button--ghost" type="button" onClick={() => void accept(doc)}>Accept</button>
          </li>
        ))}
      </ul>
      {docs.length === 0 ? <p>No documents loaded. Seeded copies remain pending_legal until legal approval.</p> : null}
    </div>
  );
}

export function AdTransparencyListPage() {
  const [rows, setRows] = useState<readonly Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void monetizationService.listPublicTransparency(50).then((result) => {
      if (!result.ok) setError(result.error.message);
      else setRows(result.data);
    });
  }, []);

  return (
    <section className="ac-card">
      <h1>Ad transparency archive</h1>
      <p>Public-safe sponsored delivery records only. Exact targeting, bids, and private advertiser billing data are excluded.</p>
      {error ? <p className="ac-error" role="alert">{error}</p> : null}
      <ul>
        {rows.map((row) => (
          <li key={String(row.id)}>
            <Link to={`/ads/transparency/${String(row.id)}`}>
              {String(row.advertiser_display_name ?? "Advertiser")} — {String(row.sponsor_label ?? "Sponsored")}
            </Link>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <p>No archived sponsored deliveries yet.</p> : null}
      <p><Link to={ROUTES.home}>Home</Link></p>
    </section>
  );
}

export function AdTransparencyDetailPage() {
  const { archiveId } = useParams();
  return (
    <section className="ac-card">
      <h1>Archive record</h1>
      <p>Archive id: <code>{archiveId}</code></p>
      <p>Creative snapshots are immutable. Unavailable media shows an explicit unavailable state rather than a placeholder claim.</p>
      <Link to="/ads/transparency">Back to archive</Link>
    </section>
  );
}

export function AdAdvertiserPublicPage() {
  const { advertiserId } = useParams();
  return (
    <section className="ac-card">
      <h1>Advertiser</h1>
      <p>Public advertiser id: <code>{advertiserId}</code></p>
      <p>
        Verified Business means PICOM reviewed company or brand information. It does not mean PICOM endorses or guarantees the ad content.
      </p>
      <Link to="/ads/transparency">Transparency archive</Link>
    </section>
  );
}
