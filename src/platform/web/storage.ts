import type { StorageAdapter } from "../types";

export const webStorage: StorageAdapter = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private / quota */
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* private / quota */
    }
  },
};
