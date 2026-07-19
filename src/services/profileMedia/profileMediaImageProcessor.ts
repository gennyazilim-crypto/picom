import type { ProfileMediaCrop, ProfileMediaKind } from "./profileMediaTypes";

type InspectResult = { width: number; height: number };
type ProcessResult = InspectResult & { blob: Blob; thumbnail: Blob; hash: string };
type WorkerSuccess =
  | ({ id: string; ok: true; action: "inspect" } & InspectResult)
  | ({ id: string; ok: true; action: "process" } & ProcessResult);
type WorkerResult = WorkerSuccess | { id: string; ok: false; message: string };

let worker: Worker | null = null;
const pending = new Map<string, { resolve: (value: WorkerSuccess) => void; reject: (reason: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./profileMediaImage.worker.ts", import.meta.url), { type: "module", name: "picom-profile-media" });
  worker.onmessage = (event: MessageEvent<WorkerResult>) => {
    const request = pending.get(event.data.id);
    if (!request) return;
    pending.delete(event.data.id);
    if (event.data.ok) request.resolve(event.data);
    else request.reject(new Error(event.data.message));
  };
  worker.onerror = () => {
    pending.forEach(({ reject }) => reject(new Error("The image worker stopped unexpectedly.")));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function request<T extends WorkerSuccess>(
  message: { action: "inspect"; file: File } | { action: "process"; file: File; kind: ProfileMediaKind; crop: ProfileMediaCrop },
  signal?: AbortSignal,
): Promise<T> {
  const id = crypto.randomUUID();
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload canceled.", "AbortError"));
      return;
    }
    const abort = () => {
      pending.delete(id);
      reject(new DOMException("Upload canceled.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    pending.set(id, {
      resolve: (value) => {
        signal?.removeEventListener("abort", abort);
        resolve(value as T);
      },
      reject: (error) => {
        signal?.removeEventListener("abort", abort);
        reject(error);
      },
    });
    getWorker().postMessage({ id, ...message });
  });
}

export const profileMediaImageProcessor = {
  async inspect(file: File, signal?: AbortSignal): Promise<InspectResult> {
    const result = await request<Extract<WorkerSuccess, { action: "inspect" }>>({ action: "inspect", file }, signal);
    return { width: result.width, height: result.height };
  },
  async process(file: File, kind: ProfileMediaKind, crop: ProfileMediaCrop, signal?: AbortSignal): Promise<ProcessResult> {
    const result = await request<Extract<WorkerSuccess, { action: "process" }>>({ action: "process", file, kind, crop }, signal);
    return { width: result.width, height: result.height, blob: result.blob, thumbnail: result.thumbnail, hash: result.hash };
  },
};
