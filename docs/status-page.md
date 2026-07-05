# Status Page Integration Placeholder

Picom has a safe placeholder for opening a public service status page from the desktop app.

## Renderer configuration

```env
VITE_STATUS_PAGE_URL=
```

The value must be a public `https://` or `http://` URL. It is renderer-visible and must never contain secrets, signed URLs, tokens, or private admin links.

## Entry points

- Settings > Advanced > Open system status
- App menu placeholder action: `open-system-status`
- Scheduled maintenance screen: System status button

## Safety rules

- All external URLs go through `externalLinkService`.
- Unsafe protocols such as `javascript:`, `file:`, and `data:` are blocked by the centralized external link service.
- If no URL is configured, the UI shows a safe placeholder message instead of opening a random destination.

## Future production path

When a production status page exists, set `VITE_STATUS_PAGE_URL` per environment. The status page should be public and non-sensitive, while operational/admin dashboards remain separate and restricted.
