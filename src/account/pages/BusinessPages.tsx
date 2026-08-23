import { useEffect, useState } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { AccountCard, AccountPageHeader, StatusBadge } from "../components/ui";
import { FormStatus } from "../components/FormStatus";
import { businessApplicationService } from "../../services/verificationBusiness/businessApplicationService";
import { businessOrganizationService } from "../../services/verificationBusiness/businessOrganizationService";
import { businessProfilePublicService } from "../../services/verificationBusiness/businessProfilePublicService";
import { businessCatalogService } from "../../services/verificationBusiness/businessCatalogService";
import type { BusinessApplicationDraftInput, BusinessCompanyType } from "../../types/verificationBusiness/businessApplication";
import { organizationService } from "../../services/verificationBusiness/platformServices";
import { ROUTES } from "../routes";
import { externalLinkService } from "../../services/externalLinkService";

const STEPS = [
  "Organization & brand",
  "Legal registration",
  "Representative",
  "Website & domain",
  "Documents notice",
  "Purpose",
  "Review & legal",
  "Submit",
] as const;

function makeKey() {
  return crypto.randomUUID();
}

export function BusinessLandingPage() {
  return (
    <section className="ac-page">
      <AccountPageHeader
        title="PICOM Business"
        description="Organizations apply on the web for Verified Business status. Personal profiles never convert into Business accounts. Advertising does not require a Business badge."
        actions={<Link className="ac-button" to={ROUTES.businessApply}>Start application</Link>}
      />
      <AccountCard title="What this is" padded>
        <ul className="ac-list">
          <li>Company verification for long-term brand collaboration</li>
          <li>Team members use their own PICOM accounts — no shared company password</li>
          <li>Public Business profile shows brand assets only after Root approval</li>
          <li>Legal documents and private registration data stay off the public profile</li>
        </ul>
      </AccountCard>
    </section>
  );
}

export function BusinessApplyPage() {
  const [step, setStep] = useState(0);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [form, setForm] = useState<BusinessApplicationDraftInput>({
    organizationId: "",
    legalName: "",
    brandName: "",
    companyType: "limited_company",
    registeredCountry: "",
    registeredAddress: "",
    representativeName: "",
    representativeEmail: "",
    officialWebsite: "",
    corporateEmailDomain: "",
    advertisingPurpose: "",
    partnershipPurpose: "",
    productsOrServicesSummary: "",
    idempotencyKey: makeKey(),
  });

  const update = <K extends keyof BusinessApplicationDraftInput>(key: K, value: BusinessApplicationDraftInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const ensureOrganization = async (): Promise<string | null> => {
    if (form.organizationId) return form.organizationId;
    if (!orgName.trim()) {
      setError("Create or enter an organization before continuing.");
      return null;
    }
    const created = await organizationService.create(orgName.trim(), form.legalName || undefined);
    if (!created.ok) {
      setError(created.error.message);
      return null;
    }
    update("organizationId", created.data);
    return created.data;
  };

  const saveDraft = async (): Promise<string | null> => {
    setBusy(true);
    setError(null);
    const organizationId = await ensureOrganization();
    if (!organizationId) {
      setBusy(false);
      return null;
    }
    const result = await businessApplicationService.upsertDraft({ ...form, organizationId });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return null;
    }
    setApplicationId(result.data);
    setInfo("Draft saved on the server.");
    return result.data;
  };

  const next = async () => {
    const id = await saveDraft();
    if (!id) return;
    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  };

  const submit = async () => {
    const id = applicationId ?? (await saveDraft());
    if (!id) return;
    setBusy(true);
    setError(null);
    const result = await businessApplicationService.submit(id, makeKey());
    setBusy(false);
    if (!result.ok) {
      const message = result.error.message || "";
      if (message.includes("LEGAL_COPY_REQUIRED") || result.error.code === "P0001") {
        setError("LEGAL COPY REQUIRED — submission is blocked until active Business legal documents are published by operations.");
      } else {
        setError(message);
      }
      return;
    }
    setStep(STEPS.length - 1);
    setInfo("Application submitted. Status is server-authoritative.");
  };

  return (
    <section className="ac-page">
      <AccountPageHeader title="Business application" description="Autosave writes to the server. Client validation is UX only; submission validation is server-side." />
      <p className="ac-muted" aria-live="polite">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
      {error ? <FormStatus tone="error" message={error} /> : null}
      {info ? <FormStatus tone="info" message={info} /> : null}
      <AccountCard title={STEPS[step]} padded>
        {step === 0 ? (
          <div className="ac-form">
            <label className="ac-field"><span>New organization display name</span><input value={orgName} onChange={(e) => setOrgName(e.target.value)} /></label>
            <label className="ac-field"><span>Or existing organization ID</span><input value={form.organizationId} onChange={(e) => update("organizationId", e.target.value)} /></label>
            <label className="ac-field"><span>Brand name</span><input required value={form.brandName} onChange={(e) => update("brandName", e.target.value)} /></label>
            <label className="ac-field"><span>Legal name</span><input required value={form.legalName} onChange={(e) => update("legalName", e.target.value)} /></label>
          </div>
        ) : null}
        {step === 1 ? (
          <div className="ac-form">
            <label className="ac-field"><span>Company type</span>
              <select value={form.companyType} onChange={(e) => update("companyType", e.target.value as BusinessCompanyType)}>
                <option value="sole_trader">Sole trader</option>
                <option value="partnership">Partnership</option>
                <option value="limited_company">Limited company</option>
                <option value="corporation">Corporation</option>
                <option value="nonprofit">Nonprofit</option>
                <option value="public_institution">Public institution</option>
                <option value="agency">Agency</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="ac-field"><span>Registered country</span><input required value={form.registeredCountry} onChange={(e) => update("registeredCountry", e.target.value)} /></label>
            <label className="ac-field"><span>Registered address (private)</span><input required value={form.registeredAddress} onChange={(e) => update("registeredAddress", e.target.value)} /></label>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="ac-form">
            <label className="ac-field"><span>Representative full name</span><input required value={form.representativeName} onChange={(e) => update("representativeName", e.target.value)} /></label>
            <label className="ac-field"><span>Representative job title</span><input value={form.representativeJobTitle ?? ""} onChange={(e) => update("representativeJobTitle", e.target.value)} /></label>
            <label className="ac-field"><span>Representative email</span><input required type="email" value={form.representativeEmail ?? ""} onChange={(e) => update("representativeEmail", e.target.value)} /></label>
            <label className="ac-field"><span>Representative phone (private)</span><input value={form.representativePhone ?? ""} onChange={(e) => update("representativePhone", e.target.value)} /></label>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="ac-form">
            <label className="ac-field"><span>Official website</span><input required value={form.officialWebsite ?? ""} onChange={(e) => update("officialWebsite", e.target.value)} /></label>
            <label className="ac-field"><span>Corporate email domain</span><input value={form.corporateEmailDomain ?? ""} onChange={(e) => update("corporateEmailDomain", e.target.value)} /></label>
          </div>
        ) : null}
        {step === 4 ? (
          <p className="ac-muted">Upload verification documents from the Documents dashboard after the draft exists. Executables and SVG documents are rejected. Malware scan stays pending until a scanner is configured — approval cannot proceed while scans are pending.</p>
        ) : null}
        {step === 5 ? (
          <div className="ac-form">
            <label className="ac-field"><span>Advertising purpose</span><textarea value={form.advertisingPurpose ?? ""} onChange={(e) => update("advertisingPurpose", e.target.value)} /></label>
            <label className="ac-field"><span>Partnership purpose</span><textarea value={form.partnershipPurpose ?? ""} onChange={(e) => update("partnershipPurpose", e.target.value)} /></label>
            <label className="ac-field"><span>Products or services summary</span><textarea value={form.productsOrServicesSummary ?? ""} onChange={(e) => update("productsOrServicesSummary", e.target.value)} /></label>
          </div>
        ) : null}
        {step === 6 ? (
          <div>
            <p>Review: {form.brandName} / {form.legalName} ({form.companyType})</p>
            <p className="ac-muted">LEGAL COPY REQUIRED: Partner Terms, Advertising Terms, Privacy Notice, Verification Notice, and Trademark declaration must be published as active versions before submit succeeds.</p>
          </div>
        ) : null}
        {step === 7 ? (
          <p>{applicationId ? <>Submitted application <code>{applicationId}</code>. <Link to={`/business/applications/${applicationId}/status`}>Open status</Link></> : "Complete prior steps first."}</p>
        ) : null}
        <div className="ac-actions-row">
          <button type="button" className="ac-button ac-button--ghost" disabled={busy || step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>Back</button>
          <button type="button" className="ac-button ac-button--ghost" disabled={busy} onClick={() => void saveDraft()}>{busy ? "Saving…" : "Save draft"}</button>
          {step < 6 ? <button type="button" className="ac-button" disabled={busy} onClick={() => void next()}>Continue</button> : null}
          {step === 6 ? <button type="button" className="ac-button" disabled={busy} onClick={() => void submit()}>{busy ? "Submitting…" : "Submit application"}</button> : null}
        </div>
      </AccountCard>
    </section>
  );
}

export function BusinessApplicationStatusPage() {
  const { id = "" } = useParams();
  const [status, setStatus] = useState<string | null>(null);
  const [brand, setBrand] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const result = await businessApplicationService.getApplicantDto(id);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setError(null);
    setStatus(result.data.status);
    setBrand(result.data.brandName);
    setReason(result.data.publicDecisionReason);
  };

  useEffect(() => {
    void load();
  }, [id]);

  return (
    <section className="ac-page">
      <AccountPageHeader title="Application status" description="Status comes from the server. This page never invents approved locally." />
      {error ? <FormStatus tone="error" message={error} /> : null}
      <AccountCard title={brand ?? "Application"} padded>
        <p>Status: <StatusBadge tone="info">{status ?? "—"}</StatusBadge></p>
        {reason ? <p className="ac-muted">Public decision: {reason}</p> : null}
        <button type="button" className="ac-button" onClick={() => void load()}>Refresh</button>
      </AccountCard>
    </section>
  );
}

export function BusinessDashboardShell() {
  return (
    <section className="ac-page">
      <AccountPageHeader title="Business dashboard" description="Organization tools for verified Business accounts." />
      <nav className="ac-actions-row" aria-label="Business dashboard">
        <Link className="ac-button ac-button--ghost" to={ROUTES.businessDashboard}>Overview</Link>
        <Link className="ac-button ac-button--ghost" to={ROUTES.businessDashboardProfile}>Profile</Link>
        <Link className="ac-button ac-button--ghost" to={ROUTES.businessDashboardProducts}>Products</Link>
        <Link className="ac-button ac-button--ghost" to={ROUTES.businessDashboardCollections}>Collections</Link>
        <Link className="ac-button ac-button--ghost" to={ROUTES.businessDashboardPosts}>Posts</Link>
        <Link className="ac-button ac-button--ghost" to={ROUTES.businessDashboardVerification}>Verification</Link>
        <Link className="ac-button ac-button--ghost" to={ROUTES.businessDashboardTeam}>Team</Link>
        <Link className="ac-button ac-button--ghost" to={ROUTES.businessDashboardDocuments}>Documents</Link>
        <Link className="ac-button ac-button--ghost" to={ROUTES.businessDashboardSettings}>Settings</Link>
      </nav>
      <Outlet />
    </section>
  );
}

export function BusinessDashboardPage() {
  return <AccountCard title="Overview" padded><p className="ac-muted">Manage profile, team, verification, and documents. Publishing requires an approved application and active Business badge.</p></AccountCard>;
}

export function BusinessProfileDashboardPage() {
  return <AccountCard title="Profile" padded><p className="ac-muted">Edit public brand fields through server-authorized profile RPCs. Legal registration fields never appear on the public profile.</p></AccountCard>;
}

export function BusinessVerificationDashboardPage() {
  const [organizationId, setOrganizationId] = useState("");
  const [domain, setDomain] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  return (
    <AccountCard title="Domain verification" padded>
      <p className="ac-muted">Domain verification is fail-closed. Consumer mail domains are rejected. Live DNS/web checks remain BLOCKED until BUSINESS_DOMAIN_VERIFICATION_ENABLED is configured.</p>
      <label className="ac-field"><span>Organization ID</span><input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} /></label>
      <label className="ac-field"><span>Domain</span><input value={domain} onChange={(e) => setDomain(e.target.value)} /></label>
      <button
        type="button"
        className="ac-button"
        onClick={() => void businessApplicationService.requestDomainVerification(organizationId, domain).then((result) => setMessage(result.ok ? "Verification challenge created (pending)." : result.error.message))}
      >
        Request verification
      </button>
      {message ? <FormStatus tone="info" message={message} /> : null}
    </AccountCard>
  );
}

export function BusinessTeamDashboardPage() {
  const [organizationId, setOrganizationId] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  return (
    <AccountCard title="Team" padded>
      <p className="ac-muted">Invitations store only token hashes. Raw tokens must be delivered via outbox email — never logged.</p>
      <label className="ac-field"><span>Organization ID</span><input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} /></label>
      <label className="ac-field"><span>Member email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <button
        type="button"
        className="ac-button"
        onClick={() => void businessOrganizationService.inviteMember({
          organizationId,
          email,
          role: "business_admin",
          expiresAt: new Date(Date.now() + 72 * 3600_000).toISOString(),
        }).then((result) => setMessage(result.ok ? "Invitation created. Deliver the raw token through the email worker only." : result.error))}
      >
        Create invitation
      </button>
      {message ? <FormStatus tone="info" message={message} /> : null}
    </AccountCard>
  );
}

export function BusinessDocumentsDashboardPage() {
  return (
    <AccountCard title="Documents" padded>
      <p className="ac-muted">Use `business-document-upload-session` for signed uploads into the private `business-verification-documents` bucket. SVG/EXE are rejected. Pending malware scan blocks approval.</p>
    </AccountCard>
  );
}

export function BusinessSettingsDashboardPage() {
  return <AccountCard title="Settings" padded><p className="ac-muted">Ownership transfer is a separate re-auth gated flow. The last organization owner cannot be removed.</p></AccountCard>;
}

export function PublicBusinessProfilePage() {
  const { slug = "" } = useParams();
  const [bundle, setBundle] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);

  const [products, setProducts] = useState<readonly Record<string, unknown>[]>([]);
  const [posts, setPosts] = useState<readonly Record<string, unknown>[]>([]);

  const load = async () => {
    const result = await businessProfilePublicService.getPublicBundle(slug.replace(/^@/, ""));
    if (!result.ok) {
      setError(typeof result.error === "string" ? result.error : "Profile unavailable");
      setBundle(null);
      setProducts([]);
      setPosts([]);
      return;
    }
    setError(null);
    const payload = result.data as { profile?: Record<string, unknown>; products?: readonly Record<string, unknown>[]; posts?: readonly Record<string, unknown>[] } | null;
    setBundle(payload?.profile ?? null);
    setProducts(payload?.products ?? []);
    setPosts(payload?.posts ?? []);
  };

  useEffect(() => {
    void load();
  }, [slug]);

  const follow = async () => {
    const organizationId = typeof bundle?.organizationId === "string" ? bundle.organizationId : null;
    if (!organizationId) return;
    const result = await businessProfilePublicService.follow(organizationId);
    if (!result.ok) setError(typeof result.error === "string" ? result.error : "Follow failed");
    else {
      setFollowing(true);
      await load();
    }
  };

  return (
    <section className="ac-page">
      <AccountPageHeader title={typeof bundle?.displayName === "string" ? bundle.displayName : "Business profile"} description="Verified Business means company or brand information was reviewed by PICOM. It is not an endorsement of product quality." />
      {error ? <FormStatus tone="error" message={error} /> : null}
      {bundle ? (
        <AccountCard title="About" padded>
          {bundle.verifiedBusiness ? <StatusBadge tone="success">Verified Business</StatusBadge> : null}
          <p>{typeof bundle.bio === "string" ? bundle.bio : ""}</p>
          <p className="ac-muted">{typeof bundle.industry === "string" ? bundle.industry : ""} · {typeof bundle.headquartersCountry === "string" ? bundle.headquartersCountry : ""}</p>
          <p className="ac-muted">Followers: {typeof bundle.followerCount === "number" ? bundle.followerCount : 0}</p>
          <div className="ac-actions-row">
            <button type="button" className="ac-button" disabled={following} onClick={() => void follow()}>{following ? "Following" : "Follow"}</button>
            <button type="button" className="ac-button ac-button--ghost" onClick={() => void load()}>Refresh</button>
          </div>
        </AccountCard>
      ) : (
        <AccountCard title="Empty" padded><p className="ac-muted">No public Business profile is available for this slug.</p></AccountCard>
      )}
      <AccountCard title="Products" padded>
        {products.length === 0 ? <p className="ac-muted">No published products to show.</p> : (
          <ul className="ac-list">{products.map((product) => <li key={String(product.id)}>{String(product.name ?? "Product")}</li>)}</ul>
        )}
      </AccountCard>
      <AccountCard title="Posts" padded>
        {posts.length === 0 ? <p className="ac-muted">No Business posts to show.</p> : (
          <ul className="ac-list">{posts.map((post) => <li key={String(post.id)}>{String(post.postType ?? "Update")}: {String(post.body ?? "").slice(0, 160)}</li>)}</ul>
        )}
      </AccountCard>
    </section>
  );
}

export function BusinessProductsDashboardPage() {
  const [organizationId, setOrganizationId] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [productId, setProductId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createDraft = async () => {
    setError(null);
    const result = await businessCatalogService.createProductDraft({
      organizationId,
      name,
      slug: slug.toLowerCase(),
      productType: "physical_product",
      shortDescription: "",
      description: "",
    });
    if (!result.ok) setError(result.error.message);
    else {
      setProductId(result.data);
      setMessage("Draft created. Publish requires approved moderation and active legal policies.");
    }
  };

  const submit = async () => {
    if (!productId) return;
    const result = await businessCatalogService.submitForReview(productId);
    if (!result.ok) setError(result.error.message);
    else setMessage("Submitted for Root review.");
  };

  const publish = async () => {
    if (!productId) return;
    const result = await businessCatalogService.publish(productId);
    if (!result.ok) {
      const text = result.error.message || "";
      setError(text.includes("LEGAL_COPY_REQUIRED") ? "LEGAL COPY REQUIRED — product publish is blocked until listing policies are active." : text);
    } else setMessage("Published (server confirmed).");
  };

  return (
    <AccountCard title="Products" padded>
      <p className="ac-muted">PICOM is a product showcase with verified external purchase links — not a marketplace checkout.</p>
      <label className="ac-field"><span>Organization ID</span><input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} /></label>
      <label className="ac-field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="ac-field"><span>Slug</span><input value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
      <div className="ac-actions-row">
        <button type="button" className="ac-button" onClick={() => void createDraft()}>Create draft</button>
        <button type="button" className="ac-button ac-button--ghost" disabled={!productId} onClick={() => void submit()}>Submit for review</button>
        <button type="button" className="ac-button ac-button--ghost" disabled={!productId} onClick={() => void publish()}>Publish</button>
      </div>
      {productId ? <p className="ac-muted">Product ID: <code>{productId}</code></p> : null}
      {error ? <FormStatus tone="error" message={error} /> : null}
      {message ? <FormStatus tone="info" message={message} /> : null}
    </AccountCard>
  );
}

export function BusinessCollectionsDashboardPage() {
  return (
    <AccountCard title="Collections" padded>
      <p className="ac-muted">Group published products into collections. “Best sellers” is never auto-ranked without real sales data.</p>
    </AccountCard>
  );
}

export function BusinessPostsDashboardPage() {
  const [organizationId, setOrganizationId] = useState("");
  const [body, setBody] = useState("");
  const [postId, setPostId] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const [promotionId, setPromotionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    const result = await businessCatalogService.createPost(organizationId, "brand_update", body);
    if (!result.ok) setError(result.error.message);
    else {
      setPostId(result.data);
      setMessage("Draft post created as organic brand content.");
    }
  };

  const publish = async () => {
    if (!postId) return;
    const result = await businessCatalogService.publishPost(postId);
    if (!result.ok) setError(result.error.message);
    else setMessage("Post published as organic. Promote creates a separate campaign draft.");
  };

  const tag = async () => {
    if (!postId || !productId) return;
    const result = await businessCatalogService.tagProduct(postId, productId, 0);
    if (!result.ok) setError(result.error.message);
    else setMessage("Product tagged. Tagging does not make the post sponsored.");
  };

  const promote = async () => {
    if (!postId) return;
    const request = await businessCatalogService.createPromotionRequest(postId);
    if (!request.ok) {
      setError(request.error.message.includes("LEGAL_COPY_REQUIRED")
        ? "LEGAL COPY REQUIRED — promotion submit blocked until sponsored/advertising policies are active."
        : request.error.message);
      return;
    }
    setPromotionId(request.data);
    const snapshot = await businessCatalogService.createCreativeSnapshot(request.data);
    if (!snapshot.ok) {
      setError(snapshot.error.message);
      return;
    }
    const campaign = await businessCatalogService.createCampaignDraft(request.data, "Business promotion draft");
    if (!campaign.ok) setError(campaign.error.message);
    else setMessage(`Promotion bridge complete. Campaign draft ${campaign.data} stays draft (not active). Source post remains organic.`);
  };

  return (
    <AccountCard title="Brand posts" padded>
      <label className="ac-field"><span>Organization ID</span><input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} /></label>
      <label className="ac-field"><span>Post body</span><textarea value={body} onChange={(e) => setBody(e.target.value)} /></label>
      <label className="ac-field"><span>Product ID to tag</span><input value={productId} onChange={(e) => setProductId(e.target.value)} /></label>
      <div className="ac-actions-row">
        <button type="button" className="ac-button" onClick={() => void create()}>Create draft</button>
        <button type="button" className="ac-button ac-button--ghost" disabled={!postId} onClick={() => void publish()}>Publish</button>
        <button type="button" className="ac-button ac-button--ghost" disabled={!postId} onClick={() => void tag()}>Tag product</button>
        <button type="button" className="ac-button" disabled={!postId} onClick={() => void promote()}>Promote (draft only)</button>
      </div>
      {postId ? <p className="ac-muted">Post ID: <code>{postId}</code></p> : null}
      {promotionId ? <p className="ac-muted">Promotion request: <code>{promotionId}</code></p> : null}
      {error ? <FormStatus tone="error" message={error} /> : null}
      {message ? <FormStatus tone="info" message={message} /> : null}
    </AccountCard>
  );
}

export function PublicBusinessProductPage() {
  const { slug = "", productSlug = "" } = useParams();
  const [product, setProduct] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void businessCatalogService.getPublicProduct(slug.replace(/^@/, ""), productSlug).then((result) => {
      if (!result.ok) {
        setError(result.error.message);
        setProduct(null);
        return;
      }
      setError(null);
      setProduct(result.data);
    });
  }, [slug, productSlug]);

  const openPurchase = async () => {
    const url = typeof product?.purchaseUrl === "string" ? product.purchaseUrl : null;
    if (!url) return;
    const domain = typeof product?.destinationDomain === "string" ? product.destinationDomain : "";
    if (!window.confirm(`Open external store on ${domain || "unknown domain"}?`)) return;
    const opened = await externalLinkService.openExternalUrl(url);
    if (!opened.ok) setError("External URL was blocked by the safe link validator.");
  };

  return (
    <section className="ac-page">
      <AccountPageHeader
        title={typeof product?.name === "string" ? product.name : "Product"}
        description="Verified Business showcase. PICOM does not process checkout for this product."
      />
      {error ? <FormStatus tone="error" message={error} /> : null}
      {product ? (
        <AccountCard title="Details" padded>
          {product.verifiedBusiness ? <StatusBadge tone="success">Verified Business</StatusBadge> : null}
          <p>{typeof product.shortDescription === "string" ? product.shortDescription : ""}</p>
          <p className="ac-muted">
            {typeof product.priceDisplayMode === "string" ? product.priceDisplayMode : ""} ·{" "}
            {typeof product.availability === "string" ? product.availability : ""}
          </p>
          {typeof product.destinationDomain === "string" && product.destinationDomain ? (
            <p className="ac-muted">Destination: {product.destinationDomain}</p>
          ) : null}
          <div className="ac-actions-row">
            <button type="button" className="ac-button" onClick={() => void openPurchase()}>Visit store</button>
            <button
              type="button"
              className="ac-button ac-button--ghost"
              onClick={() => void businessCatalogService.report({
                subjectType: "product",
                subjectId: String(product.id),
                reasonCode: "misleading_product",
                organizationId: typeof product.organizationId === "string" ? product.organizationId : undefined,
              }).then((result) => setError(result.ok ? null : result.error.message))}
            >
              Report product
            </button>
          </div>
        </AccountCard>
      ) : (
        <AccountCard title="Unavailable" padded><p className="ac-muted">No published product is available for this path.</p></AccountCard>
      )}
    </section>
  );
}
