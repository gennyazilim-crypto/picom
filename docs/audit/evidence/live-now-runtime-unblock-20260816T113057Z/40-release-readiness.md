# Runtime unblock release readiness

| Tier | Verdict | Evidence-based reason |
|---|---|---|
| INTERNAL | GO | Clean canonical package, source security, and control-plane contracts pass; affected public flags remain off. |
| CONTROLLED_BETA | BLOCKED | This current package cannot connect to voice.picom.gg on TCP 443, so real Live Now certification cannot proceed. |
| PUBLIC_BETA | BLOCKED | WSS failure, no two-client runtime proof, and external provider gates remain. |
| GA | BLOCKED | Current package is unsigned and real media, OBS, chat, analytics, team runtime, and provider gates are not certified. |

Unchanged external blockers: LIVEKIT EGRESS=BLOCKED_INFRASTRUCTURE; MEDIA STORAGE=BLOCKED_STORAGE_CREDENTIAL; PAYMENT PROVIDER=BLOCKED_PROVIDER_CONFIGURATION; LIVE PAYMENT=OFF; LEGAL=BLOCKED_CONTENT_APPROVAL; KYC PROVIDER=NOT_CONFIGURED; PAYOUT PROVIDER=NOT_CONFIGURED; LIVE PAYOUT=OFF; TAX ENGINE=BLOCKED_LEGAL_PROVIDER_CONFIGURATION.
