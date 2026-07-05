# QA Output Encoding

Picom's QA scripts should keep terminal output readable on Windows, Linux, and macOS shells. The `qa:output:smoke` gate prevents common mojibake or replacement characters from entering QA scripts.

## Why this exists

Windows terminals can render files with mixed encodings poorly. A broken success marker makes QA output harder to trust during release checks, even when the underlying command passed.

## Commands

```bash
npm run qa:output:smoke
npm run qa:smoke
```

## Rule

QA framework output should use ASCII-safe status lines. Individual test scripts may still validate user-facing Unicode in app code, but the automation gate itself should stay shell-safe.
