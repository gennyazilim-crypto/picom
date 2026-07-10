import { messageService, type MessageServiceResult, type MessageSummary, type SendMessageInput } from "./messageService";

export type QueuedSendMessageInput = SendMessageInput & Readonly<{
  localOrder: number;
}>;

export type MessageSendQueueSnapshot = Readonly<{
  channelKey: string;
  pending: boolean;
  nextLocalOrder: number;
}>;

type SendMessageFn = (input: QueuedSendMessageInput) => Promise<MessageServiceResult<MessageSummary>>;

const queues = new Map<string, Promise<void>>();
const localOrders = new Map<string, number>();

function waitForBrowserOnline(): Promise<void> {
  if (typeof navigator === "undefined" || navigator.onLine) return Promise.resolve();
  return new Promise((resolve) => window.addEventListener("online", () => resolve(), { once: true }));
}

function getChannelKey(communityId: string, channelId: string): string {
  return `${communityId}:${channelId}`;
}

function rememberQueue(channelKey: string, operation: Promise<MessageServiceResult<MessageSummary>>): void {
  const settled = operation.then(
    () => undefined,
    () => undefined,
  );

  queues.set(channelKey, settled);
  void settled.finally(() => {
    if (queues.get(channelKey) === settled) {
      queues.delete(channelKey);
    }
  });
}

export const messageSendQueueService = {
  nextLocalOrder(communityId: string, channelId: string): number {
    const key = getChannelKey(communityId, channelId);
    const next = (localOrders.get(key) ?? 0) + 1;
    localOrders.set(key, next);
    return next;
  },

  enqueue(input: QueuedSendMessageInput, send: SendMessageFn = messageService.sendMessage): Promise<MessageServiceResult<MessageSummary>> {
    const key = getChannelKey(input.communityId, input.channelId);
    const previous = queues.get(key) ?? Promise.resolve();
    const sendWhenOnline = async () => { await waitForBrowserOnline(); return send(input); };
    const operation = previous.then(sendWhenOnline, sendWhenOnline);

    rememberQueue(key, operation);
    return operation;
  },

  getSnapshot(communityId: string, channelId: string): MessageSendQueueSnapshot {
    const key = getChannelKey(communityId, channelId);
    return {
      channelKey: key,
      pending: queues.has(key),
      nextLocalOrder: (localOrders.get(key) ?? 0) + 1,
    };
  },

  resetForTests(): void {
    queues.clear();
    localOrders.clear();
  },
};
