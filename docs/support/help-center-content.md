# Picom Help Center Content

## Delivery

Picom ships a local, static Help Center inside `Settings > Help Center`. It works without internet, uses no remote scripts, and does not collect search text. The current articles are implemented in `src/components/HelpCenterView.tsx`.

## Getting started

Sign in or register, complete first-run profile setup when prompted, and choose a theme. The left server rail opens Home, direct messages, and communities. Community Sidebar changes channels; Chat Main contains the active conversation; Member Sidebar shows visible participants. `Ctrl + K` opens quick navigation and `Ctrl + ,` opens Settings.

## Joining communities

Open a community from the server rail or an approved invite. Public visitor access is read-only and includes only channels/content intentionally exposed to visitors. Join to participate. Private communities may require an invite or approval. Leaving a community can remove access to its private content.

## Sending messages

Select a text channel where you have send permission. Enter sends and Shift + Enter inserts a new line. Available message actions can include reply, reaction, edit-own, and permitted deletion. Supported image attachments are validated before upload. Users should never upload credentials, recovery codes, private keys, or untrusted files.

## Mention Feed

Home opens Mention Feed. `Feed` shows relevant/popular mentions and `Takip Ettiğin Kişiler` focuses on followed people. Stories, filters, read/saved state, reactions, and comment previews use their current supported state. `Open in channel` works only when the user can access the source community/channel.

## Profiles

Select a visible member name/avatar to open their profile. Public profile details, follow state, shared media, and recent activity must respect community/channel visibility. Blocking and relationship privacy controls are under `Settings > Privacy & Safety`.

## Voice and screen share

Open a voice channel and join after reviewing room/device status. Mute stops publishing the local microphone; deafen also stops incoming room audio. Screen share publishes only the desktop source selected through Electron. Windows, Linux, and macOS can require different system permissions. Leave the room to stop voice participation and screen sharing.

## Privacy and safety

Never share passwords, session/auth tokens, recovery codes, service-role keys, LiveKit secrets, signing credentials, or private invite links. Report suspicious content from available context actions and block users through safety controls. Data export and account-deletion status are available under Privacy & Safety/Account. Backend authorization and Supabase RLS remain authoritative.

## Troubleshooting

1. Record Picom version, release channel, operating system, package type, and whether mock or connected mode is active.
2. Confirm network/backend/realtime state and retry the smallest failing action once.
3. Restart Picom normally. Use Safe Mode only when corrupted local state or an optional native service prevents startup.
4. For update/install issues, keep the original artifact/checksum and do not disable operating-system security globally.
5. Export redacted diagnostics and provide reproducible steps, expected behavior, and actual behavior.

## Exporting diagnostics

Open `Settings > Diagnostics`, review the displayed summary, and export diagnostics/logs. Inspect the file before sharing it. Exports are designed to be redacted, but users must not manually add passwords, tokens, authorization headers, secrets, private keys, or unrelated private message content.

## Support entry points

- `Settings > Help Center`: searchable local product guidance.
- `Settings > Diagnostics`: redacted logs, diagnostic export, and beta feedback preparation.
- `Settings > Privacy & Safety`: reports, blocking, privacy controls, data export, and account deletion links.
- In-app context actions: report or safety actions where available.

External support/status URLs remain configuration-dependent and must open through Picom's safe external-link service when enabled.

## Content maintenance

- Update local articles when user-visible behavior changes.
- Keep desktop terminology aligned across Windows, Linux, and macOS.
- Do not describe placeholder or disabled features as production-ready.
- Do not include secrets, private provider URLs, internal incident details, or legal guarantees.
- Route translations through the future localization catalog rather than translating user-generated content.

