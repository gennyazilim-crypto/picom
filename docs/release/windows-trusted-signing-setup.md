# Windows code signing via Azure Trusted Signing (individual publisher)

Goal: remove the Microsoft Defender SmartScreen "Unknown publisher" warning shown when users
download `Picom-*-Windows-x64.exe` from picom.gg. The warning appears because the published
installer is **unsigned**. The fix is to sign it with a real code-signing certificate.

Picom's publisher is an **individual developer** (no registered company), so the recommended path is
**Azure Trusted Signing with individual identity validation** — cheapest (~$10/month), no hardware
token (Microsoft holds the key in an HSM), and SmartScreen trusts it from day one.

The build/CI side is already wired (see "What is already done"). The steps below are the parts only
you can do — they involve your legal identity, payment, and secrets, which the tooling never handles
for you.

## What is already done (code side)

- `electron-builder.windows-release.yml` — signed release config; extends the base config and enables
  `azureSignOptions` (electron-builder 26 native Trusted Signing). Local/dev builds stay unsigned.
- `.github/workflows/windows-signed-release.yml` — manual, protected `windows-production-signing`
  environment; fails closed if any signing value is missing; builds with the release config; then
  verifies the produced installer is actually signed with the expected publisher before uploading.
  Any version (beta or 1.0.0) can be signed, as long as `candidate_version` matches `package.json`.

## What only you can do

### 1. Create the Trusted Signing account (Azure portal)

1. Sign in to the Azure portal with a Microsoft account and an active subscription (pay-as-you-go is
   fine).
2. Create a **Trusted Signing account** (search "Trusted Signing"). Pick a region close to you — that
   region determines the endpoint (e.g. West Europe → `https://weu.codesigning.azure.net/`).
3. Under the account, create an **Identity validation → Individual**. Microsoft verifies your
   identity (government ID via their partner). This can take a few days. **This is the gating step.**
4. Once validated, create a **Certificate profile** (type: Public Trust). Note its **name** and the
   **publisher/subject** shown on it — that subject must match `WINDOWS_PUBLISHER_SUBJECT`.

> If individual validation is not available to you, the fallback is a cloud-based OV certificate
> (SSL.com / Sectigo eSigner). It also signs, but SmartScreen reputation builds over time, so the
> warning persists for a while. Tell me and I will wire that path instead.

### 2. Create an Entra ID app registration for CI auth

The signing tool authenticates with EnvironmentCredential (client secret):

1. Entra ID → App registrations → New registration (name e.g. `picom-trusted-signing-ci`).
2. Note the **Directory (tenant) ID** and **Application (client) ID**.
3. Certificates & secrets → New client secret → note the **secret value** (shown once).
4. On the Trusted Signing account → Access control (IAM) → assign the role
   **Trusted Signing Certificate Profile Signer** to this app registration.

### 3. Configure the protected GitHub environment

Repo → Settings → Environments → `windows-production-signing`.

**Secrets** (never printed, injected ephemerally):

| Secret | Value |
| --- | --- |
| `AZURE_TENANT_ID` | Directory (tenant) ID |
| `AZURE_CLIENT_ID` | Application (client) ID |
| `AZURE_CLIENT_SECRET` | Client secret value |

**Variables** (non-secret identifiers):

| Variable | Value |
| --- | --- |
| `WINDOWS_PUBLISHER_SUBJECT` | Publisher/subject name exactly as on the certificate profile |
| `AZURE_CODE_SIGNING_ENDPOINT` | Region endpoint, e.g. `https://weu.codesigning.azure.net/` |
| `AZURE_CODE_SIGNING_ACCOUNT` | Trusted Signing account name |
| `AZURE_CODE_SIGNING_PROFILE` | Certificate profile name |

### 4. Run the signing workflow

Actions → **Windows signed release candidate** → Run workflow:

- `confirm_signing_candidate`: `true`
- `candidate_commit`: full 40-char SHA to sign
- `candidate_version`: must equal `package.json` version (e.g. the current beta, or `1.0.0`)

The job builds, signs, verifies the signature/publisher, and uploads the signed installer as the
candidate artifact.

### 5. Publish the signed installer

Replace the unsigned `Picom-*-Windows-x64.exe` on picom.gg with the signed artifact from the workflow
run. From that point the SmartScreen "Unknown publisher" warning is gone for new downloads.

## Verifying locally

On a machine with the signed installer:

```powershell
Get-AuthenticodeSignature .\Picom-<version>-<channel>-Windows-x64.exe | Format-List Status, SignerCertificate
```

`Status` must be `Valid` and the signer subject must match your publisher.
