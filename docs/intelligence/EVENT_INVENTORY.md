# Picom Intelligence Engine — Event Inventory

**Task 01 · every event, classified.** Companion to
[DATA_COLLECTION_POLICY.md](./DATA_COLLECTION_POLICY.md). Tiers: **Required** (runs the
service / security; legitimate-interest or contract), **Optional** (opt-in analytics /
personalization / AI), **Forbidden** (never collected). Field naming follows the shipped
allowlist in `src/services/analyticsService.ts`; new events must be added here first.

> Convention: Optional events are **count/bucket only** and carry **no** content,
> identifiers, or free text. Metadata columns list the *only* permitted keys.

## Legend for consent tiers
- **essential** — no toggle (disclosed in privacy notice).
- **analytics** / **personalization** / **aiAssistant** / **recommendations** — independent
  opt-in switches, default OFF (see policy §3).

---

## 1. Lifecycle & session
| Event | Tier | Permitted metadata (minimized) | Consent |
|---|---|---|---|
| `app_started` | Optional | `runtime`, `releaseChannel` | analytics |
| session start/heartbeat/end | Optional | duration **bucket**, `runtime` | analytics |
| app crash-safety envelope | Required | redacted counts/codes, no content | essential (off by default toggle for reports) |
| network online/offline | Required | boolean state | essential |

## 2. Authentication & account
| Event | Tier | Permitted metadata | Consent |
|---|---|---|---|
| `login_success` | Optional | `mode` (mock/supabase) | analytics |
| login failure (rate/abuse) | Required | reason **code**, attempt count | essential (security) |
| register/verify | Optional | `mode` | analytics |
| consent granted/withdrawn | Required | `{tier, version, granted, ts}` | essential (record of consent) |
| **password, email, tokens, session** | **Forbidden** | — | — |

## 3. Navigation & feature usage
| Event | Tier | Permitted metadata | Consent |
|---|---|---|---|
| `settings_opened` | Optional | `section` | analytics |
| `feature_usage_count_only` | Optional | `feature` (allowlisted), `count` | analytics |
| view/route opened | Optional | view **name** (allowlisted), no ids | analytics |
| active-hours histogram | Optional | hour bucket, aggregate | personalization |

Allowlisted `feature` values: `mention_feed, community_chat, direct_messages, friends,
saved_messages, discovery, profile, voice, screen_share, settings`.

## 4. Community, channel & messaging
| Event | Tier | Permitted metadata | Consent |
|---|---|---|---|
| `community_created` | Optional | `mode` | analytics |
| community join/leave | Optional | count only, no community id in analytics | analytics |
| favorite/most-visited community | Optional | opaque local ranking (device-only) | personalization |
| `message_sent_count_only` | Optional | `count`, `mode` | analytics |
| reaction added (count) | Optional | `count`; favorite emoji set (device-only) | personalization |
| **message / thread / DM body, drafts, attachments** | **Forbidden** | — | — |
| **who-messaged-whom social graph for profiling** | **Forbidden** | — | — |

## 5. Direct messages
| Event | Tier | Permitted metadata | Consent |
|---|---|---|---|
| DM opened (count) | Optional | count only | analytics |
| DM sent (count) | Optional | `count` | analytics |
| **DM content, participants, attachments, call audio** | **Forbidden** | — | — |

## 6. Feed, mentions & discovery
| Event | Tier | Permitted metadata | Consent |
|---|---|---|---|
| feed impression/scroll depth | Optional | position **bucket** | analytics |
| card open/dwell | Optional | dwell **bucket**, card **type** | recommendations |
| recommendation shown/accepted/dismissed | Optional | slot, decision, no content | recommendations |
| search performed | Optional | result-count bucket, **no query text** | analytics |
| **search query text, feed content read** | **Forbidden** | — | — |

## 7. Voice, screen share & calls
| Event | Tier | Permitted metadata | Consent |
|---|---|---|---|
| `voice_joined` | Optional | `mode` | analytics |
| `voice_join_failure` | Optional | `mode` | analytics |
| `screen_share_started` | Optional | `mode` | analytics |
| voice session diagnostics | Required | duration/quality/reconnect **counts** | essential (reliability) |
| call invite sent/accepted/declined | Optional | decision, count only | analytics |
| **microphone audio, camera video, screen frames, transcripts as training** | **Forbidden** | — | — |

## 8. Downloads & installs
| Event | Tier | Permitted metadata | Consent |
|---|---|---|---|
| `upload_success` / `upload_failure` | Optional | `kind`, `sizeBucket` | analytics |
| desktop update check/download/install state | Required | normalized state, version | essential |
| download → activation conversion | Optional | funnel step, no PII | analytics |
| **file bytes, file names as payloads** | **Forbidden** | — | — |

## 9. Notifications
| Event | Tier | Permitted metadata | Consent |
|---|---|---|---|
| notification routed (desktop/inbox) | Optional | category, decision | analytics |
| notification digest engagement | Optional | open/dismiss, count | aiAssistant |
| **notification body text** | **Forbidden** | — | — |

## 10. Audio (radio / podcast)
| Event | Tier | Permitted metadata | Consent |
|---|---|---|---|
| radio/podcast play/complete (count) | Optional | count, completion **bucket** | analytics |
| favorite programs | Optional | device-only ranking | personalization |
| **listening content, raw timestamps of private sessions** | **Forbidden** | — | — |

## 11. Social graph (friends / follow / block)
| Event | Tier | Permitted metadata | Consent |
|---|---|---|---|
| friend request/accept (count) | Optional | count | analytics |
| block/mute (for safety) | Required | actor→target relation, safety only | essential (security) |
| friend-suggestion shown/accepted | Optional | slot, decision | recommendations |

## 12. Security & abuse (Required, legitimate interest)
| Event | Tier | Permitted metadata | Consent |
|---|---|---|---|
| suspicious login / velocity | Required | reason code, hashed bucket, no raw IP | essential |
| spam/bot/fake-account signal | Required | signal type, score bucket | essential |
| report submitted | Required | target type + redacted excerpt only | essential |
| rate-limit hit | Required | action, retry-after | essential |

Detailed model: [SECURITY_ENGINE.md](./SECURITY_ENGINE.md) (Task 06).

---

## Forbidden data (global, regardless of consent)
Message/DM/thread **content**, drafts, attachment/file **bytes**, **microphone audio**,
**camera/screen video**, voice **transcripts as training data**, **search query text**,
keystrokes, clipboard, **raw persisted IP**, **precise geolocation**, biometric /
special-category data, external contact books, cross-site tracking identifiers.

## Enforcement & next steps
- Allowlist + `SENSITIVE` blocklist + count clamping already in `analyticsService`;
  redaction in diagnostics/logs.
- Typed schemas, versioning, offline queue, retry → [EVENT_SCHEMA.md](./EVENT_SCHEMA.md) (Task 02).
- Retention per category → [DATA_RETENTION.md](./DATA_RETENTION.md) (Task 09).
- User review/export/delete → [PRIVACY_CENTER.md](./PRIVACY_CENTER.md) (Task 08).
