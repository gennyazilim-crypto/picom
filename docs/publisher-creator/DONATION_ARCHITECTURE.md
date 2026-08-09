# Donation Architecture

One-time payments via `publisher_donations`.

## Rules

- Server validates amount against fee policy min/max (when active) and currency allowlist
- Client amount is never authoritative for capture
- Optional message: length ≤ 280; moderation state separate from payment status
- Payment can SUCCEED while message is HIDDEN/REJECTED
- `anonymous_display` hides donor identity in Publisher UI; backend retains association as required
- Not true financial anonymity if provider records exist

## Runtime

Public Donate CTA stays OFF until `enablePublisherDonations` + provider sandbox/live gates pass.
