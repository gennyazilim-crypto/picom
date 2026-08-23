# PICOM Business Product Catalog

## Product model

`business_products` is the canonical catalog table (foundation). This release adds price display modes, brand fields, expanded types/availability, moderation reasons, and publish lifecycle RPCs.

PICOM is a **verified showcase**, not a marketplace: CTA links go to the company's external HTTPS store.

## Lifecycle

draft → in_review → published / unlisted / archived (+ rejected / suspended via Root)

Publish requires: verified Business badge, `moderation_status=approved`, no pending malware media, active catalog legal policies.

## Variants / localization / countries

Additive tables: options, option values, variants, variant values, localizations, countries.

## Media

Private bucket `business-product-media`. Pending malware stays pending; publish fails closed. Video processing stays `blocked` without a transcoder.

## Collections

Foundation collections extended with visibility/cover. No auto “best sellers” ranking without sales data.

## Legal gates

Catalog publish requires active listing policies. Seeds are `pending_legal` → **LEGAL COPY REQUIRED** until ops activates them.

## Hosted

HOSTED PRODUCTION APPLY: NOT DONE
