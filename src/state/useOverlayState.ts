import { useCallback, useEffect, useRef, useState } from "react";
import type { Attachment, Member } from "../types/community";

export interface OverlayMenuItem {
  label: string;
  tone?: "normal" | "danger";
  disabled?: boolean;
  onSelect?: () => void;
}

export interface OverlayToast {
  id: string;
  message: string;
  tone?: "info" | "error" | "success";
}

interface ContextMenuOverlay {
  x: number;
  y: number;
  items: OverlayMenuItem[];
}

interface ProfileOverlay {
  member: Member;
  x: number;
  y: number;
}

export function useOverlayState() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [menu, setMenu] = useState<ContextMenuOverlay | null>(null);
  const [profile, setProfile] = useState<ProfileOverlay | null>(null);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [toasts, setToasts] = useState<OverlayToast[]>([]);
  const toastTimeoutsRef = useRef(new Map<OverlayToast["id"], number>());

  useEffect(() => () => {
    toastTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    toastTimeoutsRef.current.clear();
  }, []);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const closeMenu = useCallback(() => setMenu(null), []);
  const closeProfile = useCallback(() => setProfile(null), []);
  const closePreview = useCallback(() => setPreview(null), []);

  const openContextMenu = useCallback((x: number, y: number, items: OverlayMenuItem[]) => {
    setProfile(null);
    setMenu({ x, y, items });
  }, []);

  const openProfile = useCallback((member: Member, x: number, y: number) => {
    setMenu(null);
    setProfile({ member, x, y });
  }, []);

  const openPreview = useCallback((attachment: Attachment) => setPreview(attachment), []);

  const closeTransientOverlays = useCallback(() => {
    setMenu(null);
    setProfile(null);
    setPreview(null);
    setPaletteOpen(false);
  }, []);

  const dismissToast = useCallback((id: OverlayToast["id"]) => {
    const timeoutId = toastTimeoutsRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      toastTimeoutsRef.current.delete(id);
    }

    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback((message: string, tone: OverlayToast["tone"] = "info") => {
    const id =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const toast: OverlayToast = { id, message, tone };
    setToasts((current) => {
      const next = [...current.slice(-2), toast];
      const visibleIds = new Set(next.map((item) => item.id));

      toastTimeoutsRef.current.forEach((timeoutId, toastId) => {
        if (visibleIds.has(toastId)) return;
        window.clearTimeout(timeoutId);
        toastTimeoutsRef.current.delete(toastId);
      });

      return next;
    });

    const timeoutId = window.setTimeout(() => {
      toastTimeoutsRef.current.delete(toast.id);
      setToasts((current) => current.filter((item) => item.id !== toast.id));
    }, 2600);
    toastTimeoutsRef.current.set(toast.id, timeoutId);
  }, []);

  return {
    settingsOpen,
    paletteOpen,
    paletteQuery,
    paletteIndex,
    menu,
    profile,
    preview,
    toasts,
    setPaletteQuery,
    setPaletteIndex,
    openSettings,
    closeSettings,
    openPalette,
    closePalette,
    openContextMenu,
    closeMenu,
    openProfile,
    closeProfile,
    openPreview,
    closePreview,
    closeTransientOverlays,
    dismissToast,
    pushToast,
  };
}
