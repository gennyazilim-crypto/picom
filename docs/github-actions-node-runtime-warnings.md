# GitHub Actions Node Runtime Warnings

## Verified warning

GitHub Actions logs showed that these JavaScript actions targeted Node.js 20 and were being forced onto Node.js 24 by the hosted runner:

- `actions/checkout@v4`
- `actions/setup-node@v4`

This warning concerns the action implementation runtime. It is separate from the Node.js version used to build Picom.

## Resolution

All Picom workflow references were updated to official Node 24 action releases:

- `actions/checkout@v7`
- `actions/setup-node@v6`

`setup-node@v6` limits automatic dependency caching behavior to npm. Picom already requests `cache: npm` explicitly and uses `package-lock.json`, so the upgrade preserves existing behavior.

`actions/upload-artifact@v4` was not named by the warning and was not changed without evidence.

## Project runtime

The Picom workflow continues to use the project-approved Node.js 24 runtime. The action-runtime upgrade does not change package execution semantics, lockfile behavior, or the renderer target.

## Security and compatibility controls

- Workflow permissions remain `contents: read` unless a specialized protected workflow requires more.
- No action receives a secret through command output or artifact upload.
- Dependency installation remains `npm ci`.
- npm caching remains bound to the committed lockfile.
- Workflow contract tests reject reintroduction of the warned Node 20 action majors.

## Verification

Task 417 validates the new versions through YAML parsing, the workflow architecture contract, and GitHub-hosted runs. Any remaining warning must be tied to its exact action and handled separately rather than changing the Picom project Node runtime.

