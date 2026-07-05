# ADR 0002 - Frontend State Management

Status: accepted

## Context

The MVP requires desktop UI state, mock data, Supabase-backed data, overlays, messaging state, settings, realtime status, and local placeholders.

## Decision

Use React + TypeScript with focused services/hooks and local component state for MVP. Avoid adding a heavy global state dependency until entity normalization and API contracts stabilize.

## Consequences

- The app stays dependency-light.
- Mock mode and Supabase mode can evolve through service boundaries.
- `App.tsx` can accumulate orchestration state and should be split later.
- Future normalized stores should be introduced only after core flows are stable.

## Alternatives considered

- Redux/Zustand/Jotai immediately: adds dependency and architecture surface before MVP state shape stabilizes.
- Ad-hoc global mutable objects: harder to test and reason about.
