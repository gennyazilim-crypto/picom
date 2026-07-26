# PICOM Desktop Checksums — 0.1.1-beta.9

```
6c7cfcc1fc38f8f208a666bb4dac4a78d8bf8ef13a50120f7cca9c90d07362ff  Picom-0.1.1-beta.9-beta-Windows-x64.exe
```

- Algorithm: SHA-256
- Source: `Get-FileHash` (local) and `sha256sum` (server + live download)
- Size: 123315761
- Code signed: false

Verification commands:

```powershell
Get-FileHash .\release\Picom-0.1.1-beta.9-beta-Windows-x64.exe -Algorithm SHA256
```

```bash
sha256sum Picom-0.1.1-beta.9-beta-Windows-x64.exe
curl -L -o /tmp/picom.exe https://picom.gg/downloads/windows/latest/Picom-0.1.1-beta.9-beta-Windows-x64.exe
sha256sum /tmp/picom.exe
```
