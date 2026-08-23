# PICOM Google Ads account handoff

Audit date: 2026-08-24

This is an operator handoff, not an account configuration. No Google Ads account,
Conversion ID, or Conversion Label was available in this checkout, and none is
invented in this document.

## Required conversion actions

### Registration Completed

Create a website conversion action with these settings:

| Setting | Required value |
| --- | --- |
| Category | Sign-up |
| Optimization | Primary |
| Value | Do not set an invented fixed monetary value. Use no value until a real business-value model is approved. |
| Count | One |
| PICOM internal event | `registration_completed` |
| Code trigger | Account Center only after both authentication and required profile persistence succeed |

Copy the following actual values from Google Ads after creation:

- Google Ads Conversion ID
- Conversion Label for this action

Place them only in the protected Account Center/web production build environment:

```text
VITE_GOOGLE_ADS_ID=<actual Google Ads Conversion ID>
VITE_GOOGLE_ADS_REGISTRATION_COMPLETED_CONVERSION_LABEL=<actual Registration Completed label>
```

Both values are mandatory. If either is absent or malformed, PICOM loads no Google
script and sends no conversion.

### Registration Started

Create a website conversion action only if the team wants this secondary funnel
signal. Choose **Sign-up** when it is available for account registration; otherwise
use the closest existing Google Ads category, such as **Begin checkout**, without
misrepresenting a payment step.

| Setting | Required value |
| --- | --- |
| Optimization | Secondary |
| Value | Do not invent a fixed monetary value. |
| Count | One |
| PICOM internal event | `registration_started` |
| Code trigger | Required client validation completed, before account creation begins |

Copy its actual Conversion ID (the same account-level ID) and Conversion Label,
then set only the label below. Leave it empty if this action is not deliberately
enabled.

```text
VITE_GOOGLE_ADS_REGISTRATION_STARTED_CONVERSION_LABEL=<actual Registration Started label>
```

### Desktop Download

The live `picom.gg` Astro source is not in this checkout, so this conversion does
not yet have a production CTA integration. Create it only when its owning site can
dispatch the equivalent consent-gated event.

| Setting | Required value |
| --- | --- |
| Category | Download |
| Optimization | Secondary |
| Value | Do not invent a fixed monetary value. |
| Count | One |
| PICOM internal event | `desktop_download_clicked` |
| Code trigger | Owned desktop-download CTA click, after consent |

Copy the actual Conversion ID and Conversion Label; set the label only when that
CTA implementation exists:

```text
VITE_GOOGLE_ADS_DOWNLOAD_CONVERSION_LABEL=<actual Desktop Download label>
```

## Signup CTA click

`signup_cta_clicked` is an internal secondary funnel event, never a primary goal.
It is optional to configure as a Google Ads secondary action. Do not add its label
unless the operator intentionally creates that secondary action:

```text
VITE_GOOGLE_ADS_SIGNUP_CONVERSION_LABEL=<actual optional Signup CTA label>
```

## Activation and verification gate

1. Create the actions above in the intended Google Ads account and collect the
   real Conversion ID and labels.
2. Confirm Registration Completed is **Primary** and every other enabled action is
   **Secondary**; PICOM code cannot enforce these account-side choices.
3. Put the public identifiers into the protected production build environment. They
   are not secrets, but must not be committed to example files or source code.
4. Deploy through the existing release process only after the `picom.gg` owner has
   implemented the same consent and attribution handoff on the Astro landing site.
5. With a consented test journey, use Tag Assistant/Google Ads diagnostics to
   confirm one `registration_completed` conversion and no conversion after consent
   withdrawal. Do not use real customer PII, enhanced conversions, or fabricated
   test conversions.

Current external state:

```text
GOOGLE ADS ACCOUNT CONFIG: BLOCKED_EXTERNAL
PRODUCTION TAG: NOT_ACTIVATED
```
