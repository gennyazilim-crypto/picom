# Risk Register

This register tracks major product, technical, security, and delivery risks for Picom.

## Risk scale

- Impact: Low, Medium, High
- Likelihood: Low, Medium, High
- Status: Open, Mitigated, Accepted, Closed

## Active risks

| ID | Risk | Impact | Likelihood | Mitigation | Status |
| --- | --- | --- | --- | --- | --- |
| R-001 | Scope drift into advanced roadmap features before MVP is stable | High | Medium | Follow the active task pack one task at a time and keep each commit scoped | Open |
| R-002 | Mobile or web-first UI accidentally replaces desktop layout | High | Low | Enforce desktop-only design docs and review UI against 4-column layout rules | Open |
| R-003 | Electron renderer gains unsafe Node/native access | High | Medium | Keep `contextIsolation` enabled, `nodeIntegration` disabled, and use preload/service wrappers | Open |
| R-004 | Supabase RLS gaps leak private community/channel data | High | Medium | Document and test RLS policies for every table before API mode is trusted | Open |
| R-005 | Service role keys or LiveKit secrets are committed or bundled | High | Low | Keep secrets server-only, use `.env.example`, and avoid adding real credentials | Open |
| R-006 | LiveKit token generation is implemented in renderer | High | Low | Generate tokens only through Supabase Edge Functions or server-side code | Open |
| R-007 | UI loses premium reference quality during implementation | Medium | Medium | Use Picom design tokens, Coolicons, and visual review at 1440x900 | Open |
| R-008 | `src/App.tsx` grows into an unmaintainable monolith | Medium | High | Split components only when task scope allows and avoid broad refactors | Open |
| R-009 | Realtime duplication causes duplicate messages | Medium | Medium | Use client IDs, event IDs, and reconciliation in future realtime tasks | Open |
| R-010 | Electron/macOS/Linux/Windows packaging diverges too late | Medium | Medium | Add platform config early and smoke test each platform path as tasks require | Open |
| R-011 | Third-party asset/license issue | Medium | Low | Use only approved Picom logo, Coolicons Free, and documented third-party assets | Open |
| R-012 | Build/test discipline weakens over many tasks | High | Medium | Commit each task separately and run the smallest relevant verification | Open |

## Review cadence

Update this register when:

- a new high-risk implementation area begins
- a risk is mitigated by code or tests
- a task uncovers a blocker
- production-readiness or release planning starts

## Current posture

The project is still early. The biggest near-term risks are scope drift, unsafe Electron setup, and weak Supabase RLS design. The next coding phase should focus on a small, secure Electron foundation before expanding product features.