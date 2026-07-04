import { useCallback, useState } from "react";
import type { Attachment, Community, Message, UserId } from "../types/community";

type AppendLocalMessageInput = {
  communityId: string;
  channelId: string;
  authorId: UserId;
  body: string;
  attachments?: Attachment[];
};

export function useLocalMessageState(initialCommunities: Community[]) {
  const [communities, setCommunities] = useState(initialCommunities);

  const appendLocalMessage = useCallback(({ communityId, channelId, authorId, body, attachments }: AppendLocalMessageInput) => {
    const idSuffix = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const message: Message = {
      id: `local-${idSuffix}`,
      channelId,
      authorId,
      body,
      createdAt: new Date().toISOString(),
      attachments,
      reactions: [],
      localStatus: "sent",
    };

    setCommunities((current) =>
      current.map((community) =>
        community.id === communityId ? { ...community, messages: [...community.messages, message] } : community,
      ),
    );

    return message;
  }, []);

  return { communities, appendLocalMessage };
}
