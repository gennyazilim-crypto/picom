# Upload Service Wrapper

Task 167 adds the MVP upload service wrapper for image attachments.

## API

`uploadService.uploadImageAttachment(input)` accepts:

- `communityId`
- `channelId`
- `file`
- `userId` optional

It returns:

- bucket name
- storage path
- sanitized file name
- MIME type
- size bytes
- public URL placeholder

## Mock mode

Mock mode validates the file and returns a pending storage-path summary without contacting Supabase.

## Supabase mode

Supabase mode:

1. validates the file with `fileService`
2. resolves the current auth user when `userId` is not provided
3. uploads into the private `message-attachments` bucket
4. uses the pending path shape required by Storage policies

## Path shape

```text
communities/{communityId}/channels/{channelId}/pending/{userId}/{id}-{safeFileName}
```

## Security notes

- File names are sanitized before storage path creation.
- Renderer uses only the normal Supabase client.
- No service-role key is used or required.
- Metadata row creation is intentionally deferred to the attachment metadata task.