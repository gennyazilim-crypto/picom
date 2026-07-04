import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "picom-member-sidebar-visible-v1";

function readStoredVisibility(defaultVisible: boolean) {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    return defaultVisible;
  }

  return defaultVisible;
}

export function useMemberSidebarState(defaultVisible = true) {
  const [membersVisible, setMembersVisible] = useState(() => readStoredVisibility(defaultVisible));

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(membersVisible));
    } catch {
      // Local persistence is a convenience only; the desktop layout should continue without it.
    }
  }, [membersVisible]);

  const showMembers = useCallback(() => setMembersVisible(true), []);
  const hideMembers = useCallback(() => setMembersVisible(false), []);
  const toggleMembersVisible = useCallback(() => setMembersVisible((visible) => !visible), []);

  return {
    membersVisible,
    showMembers,
    hideMembers,
    toggleMembersVisible,
  };
}
