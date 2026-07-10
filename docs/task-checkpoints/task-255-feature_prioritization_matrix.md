# Task 255 checkpoint: feature prioritization matrix

- Scored every remaining task from 256 through 350 for user value, delivery risk, complexity, revenue impact and security risk.
- Classified each feature as P0, P1, P2 or P3 and mapped explicit technical, operational or governance dependencies.
- Reserved P0 for release/safety blockers and completion of security-sensitive existing flows; experiments and desktop-scope reassessments remain P2/P3.
- Added a critical path and execution rules that prevent mock-only evidence or frontend checks from closing hosted security work.
- No feature, code, UI, schema, dependency or release behavior was implemented or changed.

Validation: a local documentation contract check verified continuous task coverage from 256 through 350, all five scoring dimensions, priority labels and dependency mappings. Typecheck, mock smoke and build were skipped because this task is documentation-only.
