import { FormEvent, useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/session";
import { advertisingService } from "../../services/advertising/advertisingService";
import { ROUTES } from "../routes";
import type { AdvertiserAccount, AdvertiserType, CampaignObjective } from "../../types/verificationBusiness/advertising";

export function AdvertiseLandingPage() {
  return (
    <section className="ac-card">
      <h1>Advertise on PICOM</h1>
      <p>Create an advertiser account for individuals, companies, agencies, or verified Business partners. A Business badge is not required to advertise, and it does not auto-approve creatives.</p>
      <div className="ac-actions">
        <Link className="ac-button" to={ROUTES.advertiseCreateAccount}>Create advertiser account</Link>
        <Link className="ac-button ac-button--ghost" to={ROUTES.advertiserDashboard}>Advertiser dashboard</Link>
      </div>
    </section>
  );
}

export function AdvertiseCreateAccountPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [advertiserType, setAdvertiserType] = useState<AdvertiserType>("individual");
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [countryCode, setCountryCode] = useState("DE");
  const [currency, setCurrency] = useState("EUR");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user?.id) {
      setError("Sign in required.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await advertisingService.createAdvertiserAccount({
      ownerType: "user",
      ownerId: user.id,
      advertiserType,
      displayName,
      legalName,
      countryCode,
      billingCurrency: currency,
      purpose,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    navigate(ROUTES.advertiserDashboard);
  }

  return (
    <section className="ac-card">
      <h1>Create advertiser account</h1>
      <p>Billing setup can wait for drafts. Activation and delivery remain fail-closed until funding and review complete.</p>
      <form className="ac-form" onSubmit={onSubmit}>
        <label>
          Advertiser type
          <select value={advertiserType} onChange={(e) => setAdvertiserType(e.target.value as AdvertiserType)}>
            <option value="individual">Individual</option>
            <option value="sole_trader">Sole trader</option>
            <option value="company">Company</option>
            <option value="agency">Agency</option>
            <option value="business_partner">Business partner</option>
          </select>
        </label>
        <label>
          Display name
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={2} />
        </label>
        <label>
          Legal name
          <input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        </label>
        <label>
          Country
          <input value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} maxLength={2} required />
        </label>
        <label>
          Billing currency
          <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} required />
        </label>
        <label>
          Advertising purpose
          <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </label>
        {error ? <p className="ac-error" role="alert">{error}</p> : null}
        <button className="ac-button" type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
      </form>
    </section>
  );
}

export function AdvertiserDashboardShell() {
  return (
    <div className="ac-dashboard">
      <nav className="ac-subnav" aria-label="Advertiser dashboard">
        <Link to={ROUTES.advertiserDashboard}>Overview</Link>
        <Link to={ROUTES.advertiserCampaigns}>Campaigns</Link>
        <Link to={ROUTES.advertiserCreatives}>Creatives</Link>
        <Link to={ROUTES.advertiserBilling}>Billing</Link>
        <Link to={ROUTES.advertiserReports}>Reports</Link>
        <Link to={ROUTES.advertiserTeam}>Team</Link>
        <Link to={ROUTES.advertiserSettings}>Settings</Link>
        <Link to={ROUTES.advertiserVerification}>Verification</Link>
      </nav>
      <Outlet />
    </div>
  );
}

export function AdvertiserDashboardPage() {
  const [accounts, setAccounts] = useState<readonly AdvertiserAccount[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void advertisingService.listMine().then((result) => {
      if (result.ok) setAccounts(result.data);
      else setLoadError(result.error.message);
    });
  }, []);

  return (
    <section className="ac-card">
      <h1>Advertiser dashboard</h1>
      <p>Campaigns stay draft until Root review, funding reservation, and server-side activation succeed. Fake ROAS and purchase revenue are not shown.</p>
      {loadError ? <p className="ac-error" role="alert">{loadError}</p> : null}
      {accounts.length > 0 ? (
        <ul>
          {accounts.map((account) => (
            <li key={account.id}>
              {account.displayName} — {account.advertisingStatus} / billing {account.billingStatus}
            </li>
          ))}
        </ul>
      ) : (
        <p>No advertiser accounts loaded yet.</p>
      )}
      <Link className="ac-button" to={ROUTES.advertiserCampaignNew}>New campaign</Link>
    </section>
  );
}

export function AdvertiserCampaignWizardPage() {
  const [advertiserAccountId, setAdvertiserAccountId] = useState("");
  const [name, setName] = useState("");
  const [objective, setObjective] = useState<CampaignObjective>("awareness");
  const [budget, setBudget] = useState("10000");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const created = await advertisingService.createCampaign({
      advertiserAccountId,
      name,
      objective,
      totalBudgetMinor: Number(budget) || 0,
      buyingType: "fixed_cpm",
    });
    if (!created.ok) {
      setMessage(created.error.message);
      return;
    }
    setMessage(`Draft campaign created: ${created.data}. Submit requires active legal copy.`);
  }

  return (
    <section className="ac-card">
      <h1>New campaign</h1>
      <form className="ac-form" onSubmit={onSubmit}>
        <label>
          Advertiser account id
          <input value={advertiserAccountId} onChange={(e) => setAdvertiserAccountId(e.target.value)} required />
        </label>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </label>
        <label>
          Objective
          <select value={objective} onChange={(e) => setObjective(e.target.value as CampaignObjective)}>
            <option value="awareness">awareness</option>
            <option value="reach">reach</option>
            <option value="traffic">traffic</option>
            <option value="engagement">engagement</option>
            <option value="video_views">video_views</option>
            <option value="profile_visits">profile_visits</option>
            <option value="product_views">product_views</option>
            <option value="event_interest">event_interest</option>
            <option value="app_install">app_install</option>
            <option value="lead_generation">lead_generation</option>
          </select>
        </label>
        <label>
          Total budget (minor units)
          <input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} />
        </label>
        <p>Sales / ROAS optimizer objectives are intentionally unavailable.</p>
        {message ? <p role="status">{message}</p> : null}
        <button className="ac-button" type="submit">Create draft</button>
      </form>
    </section>
  );
}

export function AdvertiserSimplePage({ title, body }: Readonly<{ title: string; body: string }>) {
  return (
    <section className="ac-card">
      <h1>{title}</h1>
      <p>{body}</p>
    </section>
  );
}
