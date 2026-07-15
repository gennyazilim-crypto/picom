# Picom Intelligence Engine — Data Collection Policy

**Task 01 · privacy-first data collection architecture**
Status: design of record. Grounds on the shipped, privacy-conscious `analyticsService`
(`src/services/analyticsService.ts`), `termsAcceptanceService`, and the diagnostics/logging
redaction layer. Companion inventory: [EVENT_INVENTORY.md](./EVENT_INVENTORY.md).

## 1. Principles (privacy by design & default)

1. **Data minimization** — collect the fewest fields that answer a concrete product
   question. Prefer **counts and buckets** over raw values (the analytics layer already
   emits `message_sent_count_only`, `feature_usage_count_only`, `sizeBucket`, never bodies).
2. **No content profiling** — message text, DM text, attachment bytes, microphone audio,
   and camera/screen video are **never** read, stored, transmitted for analytics, or used
   to train any model. This is a hard invariant, enforced in code (§5).
3. **Opt-in for anything optional** — analytics, personalization, and AI features are
   **off by default** and require an explicit, revocable choice. Essential processing
   (auth, delivering messages, crash-safety) runs on other legal bases (§3).
4. **Local-first** — optional telemetry is queued locally (`localStorage`, capped, count-
   only) and only leaves the device after consent; disabling it purges the queue.
5. **No silent identification** — the analytics layer does not attach a user id
   (`identifyUserPlaceholder` returns `identified: false`). Pseudonymous, aggregate only.
6. **Transparency & control** — every collected category is reviewable, exportable, and
   deletable from the Privacy Center (Task 08), with retention limits (Task 09).

## 2. Data classification

Every event and field is classified into exactly one tier.

| Tier | Meaning | Consent | Examples |
|---|---|---|---|
| **Required** | Needed to run the service or meet a legal/security duty. Cannot be turned off while using the feature. | Legitimate interest / contract / legal obligation (no separate toggle) | auth session validity, message **delivery** (not content analytics), abuse/security signals, crash-safety envelope |
| **Optional** | Improves the product but the app works fully without it. | **Explicit opt-in**, revocable | product analytics counts, personalization signals, AI assistant inputs, recommendation feedback |
| **Forbidden** | Must never be collected, stored, or profiled for intelligence — regardless of consent. | — (prohibited) | message/DM **content**, microphone audio, camera/screen media, attachment bytes, keystrokes, precise geolocation, biometric data, raw persisted IPs, contact-book scraping |

Rules:
- A field defaults to **Forbidden** until explicitly classified Required or Optional.
- "Optional" consent is **granular** (analytics ≠ personalization ≠ AI); one may be on
  while others are off.
- Nothing in **Optional** may reference a **Forbidden** field, even indirectly.

## 3. Legal basis (GDPR & KVKK)

Picom serves EU (GDPR) and Türkiye (KVKK / Law No. 6698) users; the model satisfies both.

| Processing | GDPR Art. 6 basis | KVKK basis |
|---|---|---|
| Authentication, session, message delivery | (b) contract | Art. 5/2-c (contract performance) |
| Abuse / spam / fraud & security signals | (f) legitimate interest | Art. 5/2-f (legitimate interest) + Art. 5/2-ç (legal obligation where applicable) |
| Crash-safety redacted envelope | (f) legitimate interest, off by default | Art. 5/2-f |
| **Product analytics** | (a) consent | Art. 5/1 **explicit consent (açık rıza)** |
| **Personalization** | (a) consent | explicit consent |
| **AI assistant inputs** | (a) consent | explicit consent |

Consent requirements (both regimes): **freely given, specific, informed, unambiguous,
opt-in (no pre-ticked boxes), and as easy to withdraw as to give.** Withdrawal is
immediate and purges the corresponding local data. Special-category data (KVKK "özel
nitelikli", GDPR Art. 9 — health, biometrics, etc.) is **not processed**.

### Consent model (tiers & lifecycle)

- **Essential** (no toggle): required processing in §2. Disclosed in the privacy notice.
- **Optional consents** (independent switches, default OFF): `analytics`,
  `personalization`, `aiAssistant`, `recommendations`.
- **Record of consent**: store `{ tier, version, granted: bool, timestamp }` — never the
  event payloads. `termsAcceptanceService` already records terms/privacy version +
  server timestamp at registration; optional-consent state extends that pattern and lives
  in the Privacy Center (Task 08).
- **Re-consent** on a material policy version bump; prior data handling honored until then.
- **Age**: users below the local digital-consent age are not offered optional data
  processing.

## 4. Roles, storage & data flow

- **Controller**: Picom (the operator). **Processor**: Supabase (hosting/DB) and, if/when
  enabled, an analytics sink — bound by a DPA, EU/adequate region, no onward profiling.
- **Flow**: `feature → analyticsService.trackEvent(name, whitelisted metadata)` →
  local queue (opt-in only) → *(future)* aggregate, pseudonymous export to the sink.
  Personalization/recommendation/AI read only from **consented** local/aggregate signals.
- **Renderer boundary**: no service-role keys, DB credentials, or provider secrets in the
  renderer (Vite `VITE_*` is public); enforced by `env-safety` / secret smokes.

## 5. Forbidden data & how the invariant is enforced

Never collected/profiled for intelligence:
- Message content, DM content, thread/reply text, draft text.
- Microphone audio, camera video, screen-share frames/audio, voice transcripts as training data.
- Attachment/file bytes or names as analytics payloads.
- Keystrokes, clipboard contents, raw persisted IP addresses, precise geolocation,
  biometric or special-category data, external contact books.

Enforcement already in code (extend, don't weaken):
- `analyticsService` **allowlists** event names and per-event metadata keys; a `SENSITIVE`
  regex rejects `message|body|password|token|secret|channel|attachment|email|username|user_id|session|authorization`; strings are length-capped and counts clamped.
- Diagnostics and logs are **redacted** (`diagnosticsService`, `loggingService`,
  `log-redaction-regression-test`) — passwords, tokens, cookies, keys removed.
- `emergencyKillSwitchService` can disable optional data paths remotely without a deploy.
- Voice/meeting diagnostics store **counts and buckets** (durations, reconnect counts),
  never audio/text.

## 6. Governance

- **Change control**: any new event/field ships with its tier, legal basis, retention
  (Task 09), and a line in [EVENT_INVENTORY.md](./EVENT_INVENTORY.md) — reviewed like a
  code change. Adding a Forbidden-touching path must fail review.
- **User rights** (access, portability, rectification, erasure, objection, withdraw
  consent): served by the Privacy Center (Task 08).
- **Retention & deletion**: defined in [DATA_RETENTION.md](./DATA_RETENTION.md) (Task 09).
- **Audit**: the whole engine is re-checked against this policy in Task 10.
