# Community Templates

Picom's community template foundation lets users pick a structured starting point while creating a community.

## Current behavior

- Create Community modal includes template selection.
- Custom is the default template.
- Templates show a compact channel preview.
- Mock-mode communities use the selected template to create default categories and channels.
- Supabase mode accepts `templateId` in the client input, but server-side template expansion is still future work.

## Included templates

- Custom
- Gaming
- Study Group
- Developer Team
- Music Community
- Design Studio
- Work Space

## Current files

- `src/types/communityTemplates.ts`
- `src/data/communityTemplates.ts`
- `src/components/CreateCommunityModal.tsx`
- `src/utils/communityFactory.ts`
- `src/services/communityService.ts`

## Future Supabase requirements

- Store or pass `templateId` during community creation.
- Expand template categories/channels transactionally on the backend.
- Create default roles and permissions safely.
- Add audit log entry for community creation.
- Keep Custom template behavior as the backward-compatible default.
