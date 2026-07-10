# Picom Legal and Policy Release Checklist

This is an engineering readiness checklist, not legal advice. Named legal/privacy/product owners must approve public release text and obligations.

## Product identity and rights

- [ ] Picom product/publisher/company/contact identity is final and consistent across installers/app/docs.
- [ ] Project distribution license or proprietary terms are explicitly chosen; no placeholder is presented as a license grant.
- [ ] Coolicons CC BY 4.0 attribution and all third-party notices are complete.
- [ ] Logo, avatars, illustrations, fonts, audio, screenshots, and mock media have documented usage rights.
- [ ] No Discord branding, logo, copied asset, or exact color identity is used.

## Terms and privacy

- [ ] Terms of Service final text, effective date, jurisdiction, eligibility, acceptable use, moderation, termination, warranty/liability, contact, and update process are approved.
- [ ] Privacy Policy final text covers controller/contact, data categories, purposes/legal bases, processors, retention, security, international transfers, user rights, deletion/export, children/age, and complaint route as applicable.
- [ ] Registration links the exact approved versions and records consent/version/timestamp where legally required.
- [ ] Existing users receive required notice/re-consent for material changes.
- [ ] Community/private-channel expectations do not claim E2EE or absolute confidentiality.

## Data and vendors

- [ ] Supabase, LiveKit, email, monitoring, CI/release, support, and future providers are listed with approved agreements/data-processing terms.
- [ ] Production regions, subprocessors, backups, logs, diagnostics, and cross-border transfers match public disclosures.
- [ ] Retention/deletion/export workflows match actual implemented behavior and are not overstated.
- [ ] Voice/screen share, attachments, presence, notifications, profile/feed data, and abuse/security metadata are disclosed accurately.

## Desktop distribution

- [ ] Windows publisher/signing and installer notices are approved.
- [ ] macOS bundle, permission purpose strings, signing/notarization, and Apple requirements are approved.
- [ ] Linux package metadata/license/notices and distribution terms are approved.
- [ ] Privacy/Terms/help/contact are accessible from the installed app without requiring hidden developer tools.
- [ ] Uninstall/local-data behavior and manual rollback instructions are accurate.

## Safety and support

- [ ] Community guidelines/acceptable use/report/block/moderation/appeal placeholders are clearly distinguished from implemented behavior.
- [ ] Security reporting, privacy requests, copyright/contact, and general support channels are staffed.
- [ ] Incident/data breach assessment/notification owners and timelines are approved.
- [ ] Known limitations are disclosed without misleading security/reliability claims.

## Sign-off

| Area | Owner | Decision | Date | Evidence |
| --- | --- | --- | --- | --- |
| Product identity/licensing | | | | |
| Terms | | | | |
| Privacy/data protection | | | | |
| Third-party/IP notices | | | | |
| Security/safety/support | | | | |
| Platform distribution | | | | |

Any unresolved required approval blocks public stable release.

GDPR/DSA counsel questions and product-workflow reconciliation are tracked in `docs/legal/gdpr-dsa-review-follow-up.md`; its review marker must be approved before final policy publication.
