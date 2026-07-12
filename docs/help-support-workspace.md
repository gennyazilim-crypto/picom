# Help and Support workspace

Help & Support is a dedicated authenticated global workspace. Its primary entry is the global sidebar utility item; it is not a User Settings section and is not duplicated in community, profile, command-palette, menu, or tray surfaces.

Local searchable articles cover Getting Started, Install/Update, Feed, Communities, Direct Messages, Voice/Screen Share, Radio, Podcasts, Troubleshooting, Export Diagnostics, and Report a Problem. Articles remain available offline and display a no-results state. Legal buttons open the bundled Terms, Privacy, Guidelines, and Acceptable Use drafts.

Export Diagnostics reuses `feedbackService.exportSupportDiagnostics` after explicit user action. The payload passes through Picom redaction and excludes secrets, tokens, credentials, private messages, media, and unredacted logs. Report a Problem copies a redacted report locally. Automated submission is not configured for beta, so the UI never claims a report was sent.

`helpSupportNavigationService` accepts only `global-sidebar` and `sanctioned-error-cta` sources. Sanctioned error CTAs may request a known article ID; unknown IDs normalize to Getting Started. Generic native menu, tray, profile, community, and command-palette Help entries are unsupported.
