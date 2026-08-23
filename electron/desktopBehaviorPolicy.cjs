"use strict";

const STARTUP_DESTINATIONS = new Set(["last", "feed", "messages", "communities"]);
const SAFE_LOCATIONS = new Set(["feed", "messages", "communities"]);

function normalizeDesktopBehavior(raw) {
  const record = raw && typeof raw === "object" ? raw : {};
  return Object.freeze({
    startupVisibility: record.startupVisibility === "tray" || (record.startupVisibility !== "normal" && record.launchMinimized === true) ? "tray" : "normal",
    closeBehavior: record.closeBehavior === "quit" || (record.closeBehavior !== "tray" && record.closeToTray === false) ? "quit" : "tray",
    startupDestination: STARTUP_DESTINATIONS.has(record.startupDestination) ? record.startupDestination : "last",
    lastSafeLocation: SAFE_LOCATIONS.has(record.lastSafeLocation) ? record.lastSafeLocation : null,
  });
}

/** A hidden startup is safe only when the OS launched PICOM and a tray is ready. */
function shouldStartHiddenInTray({ trayReady, loginStartup, explicitLaunchIntent, settings }) {
  const behavior = normalizeDesktopBehavior(settings);
  return trayReady === true && loginStartup === true && explicitLaunchIntent !== true && behavior.startupVisibility === "tray";
}

/** Intentional application exits must never be swallowed by close-to-tray. */
function shouldInterceptMainWindowClose({ isQuitting, closeBehavior, trayReady }) {
  return isQuitting !== true && closeBehavior === "tray" && trayReady === true;
}

module.exports = {
  normalizeDesktopBehavior,
  shouldStartHiddenInTray,
  shouldInterceptMainWindowClose,
};
