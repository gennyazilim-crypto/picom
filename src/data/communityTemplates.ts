import type { CommunityTemplate, CommunityTemplateId } from "../types/communityTemplates";

export const communityTemplates: readonly CommunityTemplate[] = [
  {
    id: "custom",
    name: "Custom",
    description: "Start with Picom's text-first welcome, chat, and focus rooms.",
    accentColor: "#007571",
    categories: [
      {
        name: "Information",
        channels: [
          { name: "welcome", type: "text", topic: "Start here" }
        ]
      },
      {
        name: "Channels",
        channels: [
          { name: "general", type: "text", topic: "Start the conversation" }
        ]
      },
      {
        name: "Voice",
        channels: [
          { name: "focus-room", type: "voice", topic: "A focused voice room" }
        ]
      }
    ],
    defaultRoles: ["Owner", "Member"],
    welcomeMessage: "Welcome to your new Picom community."
  },
  {
    id: "gaming",
    name: "Gaming",
    description: "Channels for squads, clips, and voice sessions.",
    accentColor: "#FF772E",
    categories: [
      {
        name: "Information",
        channels: [
          { name: "announcements", type: "text" },
          { name: "rules", type: "text" }
        ]
      },
      {
        name: "Channels",
        channels: [
          { name: "general", type: "text" },
          { name: "clips", type: "text" },
          { name: "squad-voice", type: "voice" }
        ]
      }
    ],
    defaultRoles: ["Owner", "Moderator", "Member"],
    welcomeMessage: "Welcome in. Pick a squad channel and say hello."
  },
  {
    id: "study-group",
    name: "Study Group",
    description: "A focused setup for notes, deadlines, and study rooms.",
    accentColor: "#10C2BB",
    categories: [
      {
        name: "Information",
        channels: [
          { name: "announcements", type: "text" },
          { name: "resources", type: "text" }
        ]
      },
      {
        name: "Study",
        channels: [
          { name: "general", type: "text" },
          { name: "questions", type: "text" },
          { name: "study-room", type: "voice" }
        ]
      }
    ],
    defaultRoles: ["Owner", "Admin", "Member"],
    welcomeMessage: "Welcome to the study room. Share your goals for the week."
  },
  {
    id: "developer-team",
    name: "Developer Team",
    description: "Project chat, planning, and engineering support.",
    accentColor: "#007571",
    categories: [
      {
        name: "Work Space",
        channels: [
          { name: "announcements", type: "text" },
          { name: "planning", type: "text" },
          { name: "development", type: "text" },
          { name: "standup", type: "voice" }
        ]
      }
    ],
    defaultRoles: ["Owner", "Admin", "Moderator", "Member"],
    welcomeMessage: "Welcome to the dev workspace. Start with the planning channel."
  },
  {
    id: "music-community",
    name: "Music Community",
    description: "Share tracks, sessions, and creative feedback.",
    accentColor: "#C24D0F",
    categories: [
      {
        name: "Music",
        channels: [
          { name: "general", type: "text" },
          { name: "new-releases", type: "text" },
          { name: "feedback", type: "text" },
          { name: "listening-room", type: "voice" }
        ]
      }
    ],
    defaultRoles: ["Owner", "Moderator", "Member"],
    welcomeMessage: "Welcome to the listening room. Drop a track when you are ready."
  },
  {
    id: "design-studio",
    name: "Design Studio",
    description: "A premium space for critiques, assets, and studio updates.",
    accentColor: "#752C05",
    categories: [
      {
        name: "Studio",
        channels: [
          { name: "announcements", type: "text" },
          { name: "critique", type: "text" },
          { name: "inspiration", type: "text" },
          { name: "review-room", type: "voice" }
        ]
      }
    ],
    defaultRoles: ["Owner", "Admin", "Member"],
    welcomeMessage: "Welcome to the studio. Share current work in critique."
  },
  {
    id: "work-space",
    name: "Work Space",
    description: "Team coordination, discussion, and project rooms.",
    accentColor: "#007571",
    categories: [
      {
        name: "Work Space",
        channels: [
          { name: "announcements", type: "text" },
          { name: "general", type: "text" },
          { name: "project-updates", type: "text" },
          { name: "meeting-room", type: "voice", isPrivate: true }
        ]
      }
    ],
    defaultRoles: ["Owner", "Admin", "Member", "Guest"],
    welcomeMessage: "Welcome to the workspace. Check announcements first."
  }
] as const;

export function getCommunityTemplate(templateId: string | null | undefined): CommunityTemplate {
  return communityTemplates.find((template) => template.id === templateId) ?? communityTemplates[0];
}

export function isCommunityTemplateId(value: string): value is CommunityTemplateId {
  return communityTemplates.some((template) => template.id === value);
}
