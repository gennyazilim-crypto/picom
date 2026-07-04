# Mock image attachments for 1/2/3/4 layouts

Task 066 creates explicit mock image attachment layout helpers.

## Runtime source

- `src/data/mockAttachments.ts`
- `src/data/mockMessages.ts` uses `createMockAttachmentsForMessage()`.

## Layout coverage

- 1 image: `mockAttachmentLayouts.one()`
- 2 images: `mockAttachmentLayouts.two()`
- 3 images: `mockAttachmentLayouts.three()`
- 4 images: `mockAttachmentLayouts.four()`

## Notes

- Images are generated SVG data URLs using the Picom palette.
- No remote image URLs are required.
- Attachment dimensions are included for future layout stability work.