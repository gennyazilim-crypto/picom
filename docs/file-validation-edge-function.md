# File validation Edge Function placeholder

Task 201 prepares a server-side metadata validation boundary for uploads.

## Function

```text
supabase/functions/validate-file/index.ts
```

Request shape:

```json
{
  "fileName": "image.png",
  "mimeType": "image/png",
  "sizeBytes": 12345
}
```

Success response:

```json
{
  "valid": true,
  "sanitizedFileName": "image.png"
}
```

## Current validation rules

- Allowed MIME types:
  - `image/png`
  - `image/jpeg`
  - `image/webp`
  - `image/gif`
- Allowed extensions:
  - `.png`
  - `.jpg`
  - `.jpeg`
  - `.webp`
  - `.gif`
- Maximum size: `10 MB`

The function validates metadata only. It does not read, execute, transform, scan, or store uploaded files.

## Supabase configuration

```toml
[functions.validate-file]
verify_jwt = true
```

## Security notes

- Client-side validation improves UX but is not a security boundary.
- This Edge Function can be reused by a future upload finalize/scanning flow.
- Future production upload paths should combine metadata validation, Storage policies, attachment metadata RLS, and malware scanning placeholders.
- Never log raw file contents, tokens, passwords, cookies, or authorization headers.

## Manual verification

When Supabase CLI is available:

```powershell
supabase functions serve validate-file
```

Call with a valid user token:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:54321/functions/v1/validate-file `
  -Headers @{ Authorization = "Bearer USER_ACCESS_TOKEN" } `
  -ContentType "application/json" `
  -Body '{"fileName":"picom.png","mimeType":"image/png","sizeBytes":12345}'
```

Expected: `valid: true`.

Validation failures return typed API errors:

```json
{
  "code": "UPLOAD_INVALID_TYPE",
  "message": "Only PNG, JPEG, WEBP, and GIF images are supported in the MVP.",
  "details": {
    "valid": false,
    "reason": "UNSUPPORTED_MIME_TYPE"
  }
}
```
