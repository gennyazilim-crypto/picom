import type { ProfileMediaCrop, ProfileMediaKind } from "./profileMediaTypes";

type InspectRequest = { id: string; action: "inspect"; file: File };
type ProcessRequest = { id: string; action: "process"; file: File; kind: ProfileMediaKind; crop: ProfileMediaCrop };
type WorkerRequest = InspectRequest | ProcessRequest;
type WorkerResponse =
  | { id: string; ok: true; action: "inspect"; width: number; height: number }
  | { id: string; ok: true; action: "process"; width: number; height: number; blob: Blob; thumbnail: Blob; hash: string }
  | { id: string; ok: false; message: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

function hasExpectedSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/png") {
    return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((value, index) => bytes[index] === value);
  }
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/webp") {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

async function inspect(file: File): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!hasExpectedSignature(bytes, file.type)) throw new Error("The image contents do not match its file type.");
  const bitmap = await createImageBitmap(file);
  if (bitmap.width < 1 || bitmap.height < 1 || bitmap.width > 8192 || bitmap.height > 8192) {
    bitmap.close();
    throw new Error("Image dimensions must be between 1 and 8192 pixels.");
  }
  if (bitmap.width * bitmap.height > 40_000_000) {
    bitmap.close();
    throw new Error("The decoded image is too large to process safely.");
  }
  return { bitmap, width: bitmap.width, height: bitmap.height };
}

async function render(bitmap: ImageBitmap, width: number, height: number, crop: ProfileMediaCrop): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Image processing is unavailable.");
  context.fillStyle = "#111820";
  context.fillRect(0, 0, width, height);
  const radians = (crop.rotation * Math.PI) / 180;
  const rotatedWidth = Math.abs(bitmap.width * Math.cos(radians)) + Math.abs(bitmap.height * Math.sin(radians));
  const rotatedHeight = Math.abs(bitmap.width * Math.sin(radians)) + Math.abs(bitmap.height * Math.cos(radians));
  const scale = Math.max(width / rotatedWidth, height / rotatedHeight) * Math.max(1, crop.zoom);
  context.translate(
    width / 2 + (Math.max(-100, Math.min(100, crop.offsetX)) / 100) * width * 0.35,
    height / 2 + (Math.max(-100, Math.min(100, crop.offsetY)) / 100) * height * 0.35,
  );
  context.rotate(radians);
  context.scale(scale, scale);
  context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  return canvas.convertToBlob({ type: "image/webp", quality: 0.86 });
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

scope.onmessage = (event) => {
  const request = event.data;
  void inspect(request.file)
    .then(async ({ bitmap, width, height }) => {
      if (request.action === "inspect") {
        bitmap.close();
        scope.postMessage({ id: request.id, ok: true, action: "inspect", width, height });
        return;
      }
      const mainSize = request.kind === "avatar" ? { width: 512, height: 512 } : { width: 1600, height: 500 };
      const thumbSize = request.kind === "avatar" ? { width: 96, height: 96 } : { width: 480, height: 150 };
      const [blob, thumbnail] = await Promise.all([
        render(bitmap, mainSize.width, mainSize.height, request.crop),
        render(bitmap, thumbSize.width, thumbSize.height, request.crop),
      ]);
      bitmap.close();
      scope.postMessage({
        id: request.id,
        ok: true,
        action: "process",
        width,
        height,
        blob,
        thumbnail,
        hash: await sha256(blob),
      });
    })
    .catch((error: unknown) => {
      scope.postMessage({ id: request.id, ok: false, message: error instanceof Error ? error.message : "Image processing failed." });
    });
};

export {};
