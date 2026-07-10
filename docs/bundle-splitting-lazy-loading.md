# Bundle splitting and lazy loading

## Implemented boundaries

- Profile, Mention Feed, Settings, onboarding, direct messages, friends, discovery and saved messages remain route/view-level lazy chunks.
- `StoryViewerModal` is now a second-level lazy chunk. Story cards and tabs load with Mention Feed, while viewer focus trapping, keyboard navigation and gallery overlay code loads only after a story is opened.
- `VoiceRoomView` is owned only by App and loads only when a voice channel becomes active. The unreachable duplicate voice subscription and controls in ChatMain were removed; App retains the existing voice state and actions.
- Community admin tools are grouped into one `CommunityAdminDeferredSection` chunk. Bots, webhooks, emoji/sticker management, events, moderation, channel tooling and danger-zone panels are not pulled into the core sidebar path.

## No over-splitting

Small reusable controls, AppIcon, the titlebar, ServerRail, CommunitySidebar shell, ChatMain text flow, MessageList and MessageComposer stay in their natural parent chunks. Admin tools are deliberately grouped rather than creating one network/module boundary per panel. Story progress and viewer controls stay with the modal because they are only useful inside that overlay.

## Runtime regression controls

- Each deferred route uses a Suspense boundary and a Picom token-based fallback or a non-blocking overlay fallback.
- Channel selection still branches to VoiceRoomView before ChatMain, so removing ChatMain's duplicate path does not alter voice behavior.
- Story close, previous/next, profile and open-in-channel callbacks cross the lazy boundary as typed props.
- Community permissions are evaluated before admin sections render; lazy loading changes delivery only and is not authorization.
- Packaged offline loading works because all chunks ship beside the renderer assets; unhandled renderer failures remain caught by the desktop error boundary.

## Build measurement

Run `npm run build`, then `npm run bundle:splitting:audit` and `npm run bundle:size`. The split audit requires production chunks for Profile, Mention Feed, StoryViewerModal, Settings, VoiceRoomView and grouped admin tools. The main renderer warning remains visible and must be compared with the startup budget rather than silenced.

The `voiceService` ineffective dynamic-import warning is still tracked: diagnostics and Settings consume shared voice state. Splitting that service requires a broader diagnostics/state boundary and is intentionally deferred until packaged profiling proves value.
