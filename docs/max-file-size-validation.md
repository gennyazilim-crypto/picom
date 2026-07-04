# Max File Size Validation

Task 169 aligns client-side image file size validation with the Supabase Storage bucket limit.

## Limit

- Maximum image size: `10 MB`
- Constant: `maxImageFileSizeBytes`
- Bucket migration limit: `10485760` bytes

## Behavior

`fileService.validate(file)` rejects images larger than 10 MB before preview/upload. `uploadService` uses the same validation path, so Supabase uploads inherit the same client-side limit.

## Security notes

Client-side size validation improves UX but is not sufficient by itself. Supabase Storage bucket size limits remain the backend enforcement layer.

## Manual verification

1. Try attaching an image smaller than 10 MB and confirm it is accepted.
2. Try attaching an image larger than 10 MB and confirm it is rejected with a clear error.
3. Confirm the Storage bucket migration still uses the same byte limit.