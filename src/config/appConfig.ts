export const appConfig = Object.freeze({
  name: import.meta.env.VITE_APP_NAME ?? "Picom",
  identifier: import.meta.env.VITE_APP_IDENTIFIER ?? "com.picom.desktop",
  environment: import.meta.env.VITE_APP_ENV ?? "development",
  runtimeTarget: "electron" as const,
  supportedPlatforms: ["windows", "linux", "macos"] as const
});