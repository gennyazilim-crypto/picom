# PICOM Google Ads production-readiness audit

Audit date: 2026-08-24

## Scope and current architecture

- This repository contains two relevant Vite/React applications: the authenticated web client (`vite.config.web.ts`, deployed as `app.picom.gg`) and Account Center (`vite.config.account.ts`, deployed as `account.picom.gg`). Account Center owns the actual registration form and profile-creation completion path.
- The public marketing site at `https://picom.gg` is a separately deployed Astro application. Its source, deployment configuration, CTA components, download route, and live consent implementation are not present in this repository.
- Repository search found no Google Tag Manager container, GA4 measurement ID, `gtag.js`, Google Ads ID, or existing Google Ads conversion dispatch.
- Existing repository analytics is a privacy-gated local queue with an optional configured sink. It is not GA4 and it intentionally has no external provider enabled by default.

## Implemented changes

- Added `src/services/marketing/googleAds.ts`: a single Google Ads `gtag.js` abstraction with public Vite configuration, strict ID/label validation, basic Consent Mode v2 behavior, ad-blocker-safe script loading, session-persistent primary-conversion deduplication, and SPA path tracking that excludes query strings and fragments.
- Added `src/components/marketing/MarketingConsentBoundary.tsx` on Account Center. The banner provides equally prominent "Necessary only" and "Allow optional measurement" choices, persists only the choice in a first-party `picom.gg` cookie/local storage fallback, and exposes a Cookie settings control in Account Center's public footer.
- Added Account Center registration event wiring. Owned Register CTAs emit `signup_cta_clicked`; `registration_started` follows valid required-form checks; `registration_completed` fires only after both authentication and the required profile persistence path succeed. Neither event accepts form data or user identifiers.
- Added safe first-touch attribution helpers. They retain only bounded `utm_*`, `gclid`, `gbraid`, and `wbraid` values in session storage for 30 minutes and forward them only for Picom Web's handoff to Account Center. They are never inserted into an analytics payload.
- Added public configuration entries. All five values are empty by default, so absent/malformed configuration disables tag loading rather than emitting a synthetic or sample conversion.
- Narrowed the build-time CSP expansion to exact Google origins only when a syntactically valid `VITE_GOOGLE_ADS_ID` is supplied. No wildcard CSP source or `unsafe-eval` was added.
- Updated Account Center's draft cookie/privacy pages to describe the optional mechanism and explicitly mark final legal language as `LEGAL_REVIEW_REQUIRED`. Corrected the Desktop Account Center privacy/terms URLs from the live site's 404 `/legal/...` paths to `/privacy` and `/terms`.

## Required production configuration

These are public client identifiers, not secrets. Set them only in the protected web/account production build environment after the linked Ads conversion actions exist:

```text
VITE_GOOGLE_ADS_ID=<actual Google Ads Conversion ID>
VITE_GOOGLE_ADS_REGISTRATION_COMPLETED_CONVERSION_LABEL=<actual required primary label>
VITE_GOOGLE_ADS_REGISTRATION_STARTED_CONVERSION_LABEL=<actual optional secondary label>
VITE_GOOGLE_ADS_DOWNLOAD_CONVERSION_LABEL=<actual optional secondary label>
VITE_GOOGLE_ADS_SIGNUP_CONVERSION_LABEL=<actual optional secondary label>
```

`VITE_APP_ENV` must be `production` and Vite must be building a production bundle. The actual Conversion ID and the Registration Completed label are the minimum activation contract; an empty, malformed, sample-like, or incomplete contract prevents all Google script and conversion dispatch. The other labels are optional and only enable their matching secondary action. The ID and labels are public by design; no private Google Ads credentials belong in Vite variables.

## Event taxonomy and conversion mapping

| Event | Trigger | Google Ads mapping | Payload |
| --- | --- | --- | --- |
| `marketing_landing_view` | Consent-gated Account Center SPA path observation | Page configuration only; no conversion label | Sanitized pathname only, no query/fragment |
| `signup_cta_clicked` | An owned CTA integration where available | Optional secondary only: `VITE_GOOGLE_ADS_SIGNUP_CONVERSION_LABEL`; never Primary | None |
| `registration_started` | Valid Account Center registration submission begins | Optional secondary: `VITE_GOOGLE_ADS_REGISTRATION_STARTED_CONVERSION_LABEL` | None |
| `registration_completed` | Auth plus required profile persistence succeeds | Primary: `VITE_GOOGLE_ADS_REGISTRATION_COMPLETED_CONVERSION_LABEL` | None |
| `desktop_download_clicked` | An owned desktop-download CTA integration where available | Optional `VITE_GOOGLE_ADS_DOWNLOAD_CONVERSION_LABEL` | None |

`registration_completed` is the intended Google Ads primary conversion. Configure the other labels as secondary actions in Google Ads; code cannot set that account-side goal status. Internal marketing event names are mapped to Ads labels centrally and are distinct from account-side conversion priority. A completed-registration conversion is emitted at most once per browser session; the session-only, non-identifying marker survives re-renders, route transitions, refreshes, retries, and recreated React service instances. Other events retain in-memory per-instance duplicate protection.

Desktop install/first-launch is not wired. The trustworthy chain would require a signed installer, click-ID-safe handoff, and a server-side or provider-approved first-launch receipt. This repository has no verified chain, so it deliberately generates no install conversion.

## Consent Mode v2

The Account Center implementation is **basic consent mode**:

1. Before an affirmative choice, no Google tag script, conversion event, or consent ping is loaded/sent.
2. On approval, the service queues the v2 default state before tag configuration and sets `ad_storage`, `analytics_storage`, `ad_user_data`, and `ad_personalization` to `granted`.
3. On rejection, all four values remain `denied` and no tag is loaded.
4. If a previously approved user changes settings to necessary-only, a loaded tag receives a v2 `update` setting all four values to `denied`.

The public `picom.gg` Astro site already exposes a live consent banner and Cookie settings control, but its source is outside this checkout. Its CMP must be updated by its owning repository to send the same v2 state before Google Ads is enabled there. Do not add a second independent tag manager container.

The Account Center code path is tested locally; the production-wide Consent Mode v2 verdict remains `FAIL` until the separately owned `picom.gg` CMP/tag integration is deployed and verified.

## Attribution

- Supported: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, `gbraid`, `wbraid`.
- Safeguards: known keys only, a strict URL-safe character allowlist, 160-character cap, control-character and email-shaped-value rejection, 30-minute session-only TTL, no arbitrary query persistence, and no analytics payload use.
- Implemented cross-origin handoff: `app.picom.gg/register` to `account.picom.gg/register`.
- Not implemented: `picom.gg` landing-to-Account-Center propagation, because that Astro source is absent from this repository. Google click identifiers from the live marketing CTA must be preserved there before primary conversion attribution can be considered complete.

## Security findings

- Repository build CSP previously allowed only `script-src 'self'`; the conditional allowlist now adds exact Google tag/network origins only when a valid Ads ID is present. No `*`, broad Google wildcard, or `unsafe-eval` is introduced.
- Query attribution is parsed through `URLSearchParams`, allowlisted, bounded, and never rendered as HTML or used as a redirect destination.
- The Account Center handoff nonce is still generated and validated by the existing auth flow. Attribution does not alter the target origin or authentication destination.
- Google Ads dispatches a fixed `{ send_to }` object only. Email, username, password, full name, IP, raw user ID, and message content cannot be included by the central event API.
- Live header checks on 2026-08-23 and rechecked on 2026-08-24: `picom.gg`, `account.picom.gg/register`, and `app.picom.gg` returned HTTPS 200 but no `Content-Security-Policy` or `Strict-Transport-Security` response header. Vite's meta CSP is defense in depth, not a substitute for deployment headers. Configure server-side headers before enabling Ads.

## Legal and privacy review

`LEGAL_REVIEW_REQUIRED` for: the public privacy/cookie policy disclosure, controller/processor roles, lawful basis, EEA/UK and other regional behavior, consent-record requirements, Google data terms, data transfers, retention, and whether any Google Ads features beyond basic conversion tracking (remarketing, enhanced conversions, user-provided data) may be enabled.

Enhanced conversions are intentionally out of scope. No hash of email or any other user-provided data is sent to Google.

## Production verification performed

| Surface | Result | Evidence / limitation |
| --- | --- | --- |
| `https://picom.gg` | PARTIAL | HTTPS 200; product description, desktop download CTAs, Account Center registration CTA, privacy/terms/cookies links, and Cookie settings were visible in the live HTML. Its source is external to this repository. |
| `https://account.picom.gg/register` | PARTIAL | HTTPS 200 and SPA entry returned. Registration was not submitted because no safe production test account/authorization was provided. |
| `https://app.picom.gg` | PARTIAL | HTTPS 200; source route is in this checkout, but no authenticated journey was performed. |
| `picom.gg/legal/privacy`, `/legal/terms`, `/legal/cookies` | FAIL | All three returned 404; the live site uses `/privacy`, `/terms`, and `/cookies` instead. The repository's Desktop Account Center privacy/terms constants were corrected; the absent public `licenses` path and any legacy external links still need the marketing-site owner. |
| Live GA/GTM/Ads configuration | BLOCKED_EXTERNAL | No account access, conversion ID, Tag Assistant verification, or consent/network evidence was supplied. |

## Tests

Run the focused test with:

```powershell
node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/google-ads-readiness.test.mts
```

It covers denied/granted/withdrawn consent, configuration guard behavior, non-production suppression, primary registration deduplication across recreated service instances, malformed UTM handling, 30-minute attribution expiry, and PII-free conversion payload behavior. Add this command to the protected web/account build gate after the current dirty-tree work is consolidated.

Result: `GOOGLE_ADS_READINESS_TEST=PASS`; `npm run typecheck`, `npm run intelligence:taxonomy:validate`, `npm run build:account`, and `npm run build:web` also passed. The two Vite builds retain pre-existing chunk-size and ineffective-dynamic-import warnings.

Phase 2 re-ran the focused test after the deduplication/TTL changes and received
`GOOGLE_ADS_READINESS_TEST=PASS`. `npm run production:config:guard`,
`npm run typecheck`, `npm run build:account`, and `npm run build:web` passed on
2026-08-24. A direct CSP contract check also returned
`GOOGLE_ADS_CSP_CONTRACT=PASS`: no Google origin is present without the required
primary contract, the exact tag origin appears with a valid contract, and no
wildcard is introduced. The builds retain only their pre-existing configuration,
chunk-size, and ineffective-dynamic-import warnings.

`npm run env:placeholders:check` was also inspected but remains `FAIL` on the pre-existing non-empty `SUPABASE_PROJECT_REF` in `.env.production.example`; the Google Ads additions use empty public variables and did not alter that value.

## External blockers

1. `GOOGLE_ADS_ACCOUNT_CONFIGURATION: BLOCKED_EXTERNAL` — a real Ads account, conversion ID, labels, conversion-goal primary/secondary settings, account data terms, and Tag Assistant validation are not available here.
2. The source/deployment of the live `picom.gg` Astro landing page is absent. Its CTA instrumentation, Consent Mode v2 integration, UTM/gclid pass-through, download conversion, performance audit, and legal-page URL repair require that owner.
3. Desktop install/first-launch attribution lacks a verified signed-installer/server receipt chain and remains intentionally untracked.
4. Legal review and production server header deployment remain required.

## Phase 2 evidence and dirty-worktree boundary

The worktree was inspected before edits and contained approximately 493 existing
changes. No reset, checkout, stash, commit, bulk format, deployment, production
data mutation, or non-Ads source change was performed in this phase.

The known Google Ads scope is limited to the existing environment examples,
Account Center consent/CTA/registration integration, `src/web/WebAppRoot.tsx`,
`vite.config.ts`, the `src/services/marketing/` and `src/components/marketing/`
directories, the focused test, and these two audit documents. Other dirty entries
were intentionally left untouched. This scope statement identifies the Ads work;
it does not claim ownership of unrelated pre-existing changes in files that were
already dirty.

Phase 2 strengthened the production contract so a real Conversion ID **and** a
valid `registration_completed` label are required before either CSP Google origins
or tag loading are enabled. It added a session-only, non-identifying completion
marker to prevent repeat primary conversion dispatch on retry, re-render, route
change, refresh, or a recreated React service. The focused test proves that a
second service instance sharing the same session storage cannot emit a second
conversion. This intentionally matches the Google Ads **Count: One** account-side
setting; a new browser session is not treated as a trusted new registration by the
client code.

Attribution storage now uses a versioned record with a 30-minute session TTL. It
retains only the documented allowlisted keys, rejects control characters, email
shapes, and non URL-safe characters, and removes expired or malformed records.
The `app.picom.gg/register` to Account Center handoff remains covered. The source
for `picom.gg` was checked only inside this worktree: no `astro.config.*` or
`.astro` source was found, so landing-page capture and the landing-to-Account
Center handoff remain externally owned.

`docs/audit/google-ads-account-handoff.md` records the exact Google Ads UI setup
and makes no guess at any account value. It standardizes Registration Completed as
Sign-up / Primary / Count One, and Registration Started plus Desktop Download as
Secondary / Count One. Signup CTA is never a primary conversion.

## Current verdict

```text
GOOGLE ADS CODE: PASS
PRODUCTION CONFIG CONTRACT: PASS
REGISTRATION CONVERSION: PASS (CODE ONLY)
CONVERSION DEDUPLICATION: PASS
ATTRIBUTION: PARTIAL
CONSENT: PARTIAL
PII SAFETY: PASS
MAIN WEBSITE SOURCE: BLOCKED_NOT_IN_WORKTREE
CSP: FAIL
HSTS: FAIL
TESTS: PASS
GOOGLE ADS ACCOUNT CONFIG: BLOCKED_EXTERNAL
PRODUCTION TAG: NOT_ACTIVATED
FINAL: BLOCKED
```

`CONSENT: PARTIAL` means Account Center's basic Consent Mode v2 behavior is locally
tested, including withdrawal, but the separately owned live Astro CMP is not in
this checkout and production-wide Consent Mode v2 is therefore **not PASS**.
`REGISTRATION CONVERSION: PASS (CODE ONLY)` does not claim an account-side Google
Ads conversion, production tag, or Tag Assistant verification. No `READY` state is
valid until the external blockers above are closed.
