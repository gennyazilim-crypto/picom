# Image File Type Validation

Task 168 strengthens image validation for MVP uploads.

## Allowed MIME types

- `image/png`
- `image/jpeg`
- `image/webp`
- `image/gif`

## Allowed file extensions

- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.gif`

## Validation behavior

`fileService.validate(file)` now checks both MIME type and file extension before allowing a preview/upload path. `uploadService` also uses this validation, so Supabase uploads inherit the same rules.

## Security notes

Client-side validation improves UX but is not a complete security boundary. Supabase Storage bucket MIME allowlists and future server-side metadata checks must remain in place.

## Manual verification

1. Try attaching a PNG/JPEG/WEBP/GIF image and confirm it is accepted.
2. Try attaching a non-image file and confirm it is rejected.
3. Try a file with an unsupported extension and confirm it is rejected.