export type PollOption = Readonly<{ id: string; text: string; position: number; voteCount: number; votedByCurrentUser?: boolean }>;
export type PollData = Readonly<{ id: string; messageId: string; question: string; allowMultiple: boolean; closesAt?: string; createdAt: string; options: PollOption[] }>;
export type CreatePollDraft = Readonly<{ question: string; options: string[]; allowMultiple: boolean; closesAt?: string }>;
