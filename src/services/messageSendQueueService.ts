import { messageService, type MessageServiceResult, type MessageSummary, type SendMessageInput } from "./messageService";

export type QueuedSendMessageInput = SendMessageInput & Readonly<{ localOrder: number }>;

export type MessageSendQueueSnapshot = Readonly<{
  channelKey: string;
  pending: boolean;
  pendingCount: number;
  totalPending: number;
  nextLocalOrder: number;
  maxPendingPerChannel: number;
  maxPendingTotal: number;
}>;

type SendMessageFn = (input: QueuedSendMessageInput) => Promise<MessageServiceResult<MessageSummary>>;

const maxPendingPerChannel = 25;
const maxPendingTotal = 100;
const queues = new Map<string, Promise<void>>();
const localOrders = new Map<string, number>();
const pendingByChannel = new Map<string, Set<string>>();
const operationsByClientMessageId = new Map<string, Promise<MessageServiceResult<MessageSummary>>>();
const canceledClientMessageIds = new Set<string>();

function waitForBrowserOnline(): Promise<void> {
  if (typeof navigator === "undefined" || navigator.onLine) return Promise.resolve();
  return new Promise((resolve) => window.addEventListener("online", () => resolve(), { once: true }));
}

function getChannelKey(communityId: string, channelId: string): string {
  return `${communityId}:${channelId}`;
}

function queueError(code: "QUEUE_FULL" | "QUEUE_CANCELED", message: string): MessageServiceResult<MessageSummary> {
  return { ok: false, error: { code, message } };
}

function getTotalPending(): number {
  let total = 0;
  for (const entries of pendingByChannel.values()) total += entries.size;
  return total;
}

function rememberQueue(channelKey: string, operation: Promise<MessageServiceResult<MessageSummary>>): void {
  const settled = operation.then(() => undefined, () => undefined);
  queues.set(channelKey, settled);
  void settled.finally(() => {
    if (queues.get(channelKey) === settled) queues.delete(channelKey);
  });
}

function unregister(channelKey: string, clientMessageId: string): void {
  const channelPending = pendingByChannel.get(channelKey);
  channelPending?.delete(clientMessageId);
  if (channelPending?.size === 0) pendingByChannel.delete(channelKey);
  operationsByClientMessageId.delete(clientMessageId);
  canceledClientMessageIds.delete(clientMessageId);
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
    const clientMessageId = input.clientMessageId?.trim() || `volatile-${key}-${input.localOrder}`;
    const existing = operationsByClientMessageId.get(clientMessageId);
    if (existing) return existing;

    const channelPending = pendingByChannel.get(key) ?? new Set<string>();
    if (channelPending.size >= maxPendingPerChannel || getTotalPending() >= maxPendingTotal) {
      return Promise.resolve(queueError("QUEUE_FULL", "The offline send queue is full. Copy the message text and retry after Picom reconnects."));
    }

    channelPending.add(clientMessageId);
    pendingByChannel.set(key, channelPending);
    const previous = queues.get(key) ?? Promise.resolve();
    const sendWhenOnline = async () => {
      await waitForBrowserOnline();
      if (canceledClientMessageIds.has(clientMessageId)) return queueError("QUEUE_CANCELED", "Queued message removed before reconnect.");
      return send(input);
    };
    const operation = previous.then(sendWhenOnline, sendWhenOnline);

    operationsByClientMessageId.set(clientMessageId, operation);
    rememberQueue(key, operation);
    void operation.then(() => unregister(key, clientMessageId), () => unregister(key, clientMessageId));
    return operation;
  },

  cancelPending(clientMessageId: string): boolean {
    if (!operationsByClientMessageId.has(clientMessageId)) return false;
    canceledClientMessageIds.add(clientMessageId);
    return true;
  },

  getSnapshot(communityId: string, channelId: string): MessageSendQueueSnapshot {
    const key = getChannelKey(communityId, channelId);
    return {
      channelKey: key,
      pending: queues.has(key),
      pendingCount: pendingByChannel.get(key)?.size ?? 0,
      totalPending: getTotalPending(),
      nextLocalOrder: (localOrders.get(key) ?? 0) + 1,
      maxPendingPerChannel,
      maxPendingTotal,
    };
  },

  getGlobalSnapshot() {
    return { totalPending: getTotalPending(), maxPendingTotal, maxPendingPerChannel } as const;
  },

  resetForTests(): void {
    queues.clear();
    localOrders.clear();
    pendingByChannel.clear();
    operationsByClientMessageId.clear();
    canceledClientMessageIds.clear();
  },
};
