# Windows Release Blocker Closure Evidence

Date: 2026-07-19

## Decision

- Windows beta/release-candidate technical status: **GO**
- Public trusted stable release status: **NO-GO**
- Linux and macOS are outside this Windows-only closure pass.

The technical package chain is complete. Public stable promotion remains blocked only by external trust, approval, and clean-machine evidence that cannot be fabricated locally.

## Completed evidence

- Frozen GitHub source commit: `0f6074213e33e262f2b8e29abb79999cb8489007`
- Package version/channel: `0.1.1-beta.4` / `beta`
- Clean checkout dependency install: pass, zero reported vulnerabilities
- TypeScript and production build: pass
- Windows NSIS package: pass
- Release checksum contract: pass
- Release provenance contract: pass
- Windows signing fail-closed control contract: pass
- Windows signing production workflow contract: pass
- Silent per-user install smoke: exit code 0
- Installed executable existence check: pass
- Silent uninstall smoke: exit code 0
- Temporary install directory cleanup: pass

## Candidate artifact

- File: `Picom-0.1.1-beta.4-beta-Windows-x64.exe`
- Size: 122,151,191 bytes
- SHA-256: `fb17bbd48c677f78215c95ac2dd616fc4b8e875719339e54022360fc0de900a5`
- Evidence directory: `release/candidate-0.1.1-beta.4-windows-x64/`
- Provenance commit matches the frozen GitHub commit.
- Authenticode status: `NotSigned`

## External blockers that remain open

1. No trusted code-signing certificate with a private key is installed or configured.
2. The GitHub `windows-production-signing` environment does not exist. The authenticated CLI account received HTTP 403 when attempting to create it because repository administration permission is required.
3. Protected signing secrets `WINDOWS_CSC_LINK` and `WINDOWS_CSC_KEY_PASSWORD`, and variable `WINDOWS_PUBLISHER_SUBJECT`, cannot be configured until a real certificate and repository administrator are available.
4. The protected workflow requires exact version `1.0.0`; the source remains correctly labeled `0.1.1-beta.4` until trusted signing is available.
5. Windows 10 and Windows 11 clean-machine certification must run against the final post-signing bytes.
6. Named legal and operations approvals remain human authorization gates.

## Closure rule

Do not rename this unsigned beta artifact to stable. After the repository administrator creates the protected environment and the trusted certificate is supplied, dispatch `.github/workflows/windows-signed-release.yml` with the exact approved commit. Generate checksums and provenance only after signature, publisher, and timestamp verification pass.
