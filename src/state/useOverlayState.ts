import { useCallback, useState } from "react";
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
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback((message: string, tone: OverlayToast["tone"] = "info") => {
    const id =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const toast: OverlayToast = { id, message, tone };
    setToasts((current) => [...current.slice(-2), toast]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== toast.id)), 2600);
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
