# Independent scroll containers

Task 040 prepares the MVP shell so each desktop column owns its own scroll behavior.

## Scroll model

- The desktop app frame and page root stay fixed.
- Community channel lists scroll inside the CommunitySidebar.
- Messages scroll inside ChatMain while the composer remains pinned.
- Member lists scroll inside MemberSidebar.
- Overlay result lists, such as the command palette, scroll independently.

## Manual verification

- Add enough messages or use existing mock data to scroll the chat list.
- Confirm the composer stays pinned at the bottom.
- Scroll channels and members independently.
- Confirm the outer app frame does not page-scroll.