const STORAGE_KEY = "picom.accountSwitcher.metadata.v1";

export interface AccountSwitcherEntry {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  lastUsedAt: string;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readAccounts(): AccountSwitcherEntry[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AccountSwitcherEntry[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry) =>
      Boolean(entry?.userId && entry.displayName && entry.username && entry.lastUsedAt),
    );
  } catch {
    return [];
  }
}

function writeAccounts(accounts: AccountSwitcherEntry[]): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // Account switcher metadata is best-effort and must never block auth.
  }
}

export const accountSwitcherService = {
  listAccounts(): AccountSwitcherEntry[] {
    return readAccounts().sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
  },

  rememberAccount(entry: Omit<AccountSwitcherEntry, "lastUsedAt"> & { lastUsedAt?: string }): AccountSwitcherEntry {
    const next: AccountSwitcherEntry = {
      ...entry,
      lastUsedAt: entry.lastUsedAt ?? new Date().toISOString(),
    };
    const accounts = readAccounts().filter((account) => account.userId !== next.userId);
    const updated = [next, ...accounts].slice(0, 6);
    writeAccounts(updated);
    return next;
  },

  removeAccount(userId: string): void {
    writeAccounts(readAccounts().filter((account) => account.userId !== userId));
  },

  clearAccounts(): void {
    writeAccounts([]);
  },

  getStorageKey(): string {
    return STORAGE_KEY;
  },
};
