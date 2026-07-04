# Full MVP scope lock

Picom is locked to the Full MVP.

Picom is an Electron desktop app for Windows, Linux, and macOS. It is a premium desktop community chat app inspired by uploaded UI references while using Picom's own visual identity, Coolicons/AppIcon, design tokens, and light/dark themes.

## Non-negotiable rules

- Do not create mobile UI.
- Do not create web-first responsive UI.
- Do not use Discord branding, logos, copied assets, or exact Discord colors.
- Use Picom's own visual identity.
- Use Coolicons/AppIcon for icons.
- Use design tokens.
- Keep light/dark mode.
- Do one task at a time.
- Do not delete previous work.
- Do not refactor unrelated working code.
- Do not add advanced post-MVP features.

## Full MVP includes

### 1. Electron desktop shell

- custom titlebar
- no native File/Edit/View menu
- minimize/maximize/close working
- safe preload IPC
- `contextIsolation: true`
- `nodeIntegration: false`
- Windows/Linux/macOS support

### 2. Premium UI

- ServerRail
- CommunitySidebar
- ChatMain
- MemberSidebar
- MessageComposer
- SettingsModal
- ContextMenu
- ImagePreviewModal
- Mention Feed
- Full Profile Page
- Light/dark theme
- Rounded premium app frame

### 3. Supabase backend

- Supabase Auth
- Supabase Postgres
- Supabase RLS
- Supabase Storage
- Supabase Realtime
- Supabase Edge Functions where needed

### 4. Auth

- Login
- Register
- Logout
- Session restore
- Protected app route
- Profile created after signup

### 5. Community and channels

- Community list
- Create community
- Switch community
- Channel list
- Create channel
- Switch channel
- Private channel flag
- Basic permissions

### 6. Messaging

- Send message
- Fetch messages
- Edit own message
- Delete own message
- Moderator/admin delete permission
- Realtime message insert/update/delete
- Typing indicator
- Unread/mention foundation
- Optimistic send
- Duplicate prevention

### 7. Attachments

- Image upload using Supabase Storage
- PNG/JPG/WEBP/GIF support
- File validation
- Max file size
- Attachment metadata
- AttachmentGrid
- ImagePreviewModal

### 8. Emoji, reactions, replies

- EmojiPicker MVP
- Insert emoji into composer
- Add reaction to message
- Remove reaction
- Reaction counts
- Full reply system
- Composer reply preview
- Message reply preview
- Deleted reply fallback

### 9. Home Mention Feed

- Home button opens Mention Feed
- Not Direct Messages
- Not general social feed
- Two tabs only:
  - Feed
  - Takip Ettiğin Kişiler
- Feed shows popular people mentions
- Takip Ettiğin Kişiler shows followed people mentions
- Mention cards can show text/images/reactions
- Open in channel works
- Follow/saved/read local state works

### 10. Full Profile Page

- Clicking user avatar/name opens full ProfileView
- Left profile card
- Main profile gallery/stats/bio/details
- Skills/tags
- Recent activity
- Shared media
- Follow/unfollow local state
- Open activity in channel
- Image preview

### 11. Voice chat

- LiveKit token Edge Function
- Join voice room
- Leave voice room
- Mute
- Deafen
- Speaking indicator
- Participants list
- Voice room state

### 12. Screen share

- Electron desktopCapturer source picker
- Start screen share
- Stop screen share
- LiveKit screen share track
- macOS permission notes
- Windows/Linux/macOS QA

### 13. Settings

- Account
- Profile
- Appearance
- Notifications
- Voice & Video
- Keyboard Shortcuts
- Advanced
- Theme switch
- Profile edit
- Basic notification settings
- Diagnostics/log export basic

### 14. QA/build

- Mock mode works
- Supabase mode works
- RLS tests
- Realtime two-window test
- Voice/screen share test
- Windows package smoke test
- Linux package smoke test
- macOS package smoke test

## Not included in Full MVP

- Bot marketplace
- Webhook production system
- Plugin runtime
- Enterprise admin console
- SSO
- SCIM
- Billing
- Public discovery marketplace
- Production auto-update
- E2EE production
- Advanced analytics
- Mobile app

## Operating rule

Every future task should be checked against this scope lock before implementation. If a task asks for a post-MVP feature, document or postpone it unless the user explicitly changes the Full MVP lock.
