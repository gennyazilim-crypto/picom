type StorageStatus = {
  mode: "os_protected" | "memory_only";
  persistent: boolean;
  backend: string;
  reason?: "OS_PROTECTED_STORAGE_UNAVAILABLE";
};

const memoryFallback = new Map<string, string>();
const bridge = () => window.picomDesktop?.auth?.secureStorage;

async function getItem(key: string): Promise<string | null> {
  const native = bridge();
  if (!native) return memoryFallback.get(key) ?? null;
  const result = await native.getItem(key);
  if (!result.ok) throw new Error("SECURE_AUTH_STORAGE_READ_FAILED");
  return result.value;
}
async function setItem(key: string, value: string): Promise<void> {
  const native = bridge();
  if (!native) {
    memoryFallback.set(key, value);
    return;
  }
  const result = await native.setItem(key, value);
  if (!result.ok) throw new Error("SECURE_AUTH_STORAGE_WRITE_FAILED");
}
async function removeItem(key: string): Promise<void> {
  const native = bridge();
  if (!native) {
    memoryFallback.delete(key);
    return;
  }
  const result = await native.removeItem(key);
  if (!result.ok) throw new Error("SECURE_AUTH_STORAGE_REMOVE_FAILED");
}
async function getStatus(): Promise<StorageStatus> {
  const native = bridge();
  if (!native) return { mode: "memory_only", persistent: false, backend: "renderer_memory", reason: "OS_PROTECTED_STORAGE_UNAVAILABLE" };
  const result = await native.getStatus();
  return result.ok ? result.status : { mode: "memory_only", persistent: false, backend: "unavailable", reason: "OS_PROTECTED_STORAGE_UNAVAILABLE" };
}

export const secureAuthStorage = Object.freeze({ getItem, setItem, removeItem });
export const secureAuthStorageService = Object.freeze({ getStatus });
