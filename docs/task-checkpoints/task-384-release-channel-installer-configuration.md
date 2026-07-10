# Task 384 Checkpoint: Release Channel Installer Configuration

## Result

Aligned renderer/About, package metadata, and artifact naming for dev/beta/stable
installer channels while keeping stable explicit-only.

## Implemented

- Derived beta safely from beta SemVer when runtime env is absent.
- Preserved explicit environment override for dev/beta/stable.
- Prevented automatic stable inference.
- Added packaged `picomReleaseChannel` metadata.
- Added installer channel smoke coverage and release documentation.

## Current candidate

`0.1.1-beta.1` remains a beta candidate. No artifact was promoted or published,
and production auto-update remains outside this task.
