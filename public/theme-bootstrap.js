(function applyPicomAppearanceBeforeRender() {
  var themePreference = "system";
  var language = "en";
  var density = "comfortable";
  var dateStyle = "system";
  var timeFormat = "system";
  var accessibility = {};

  try {
    var safeModeForced = window.localStorage.getItem("picom:safe-mode:forced") === "true";
    var rawSettings = window.localStorage.getItem("picom-settings");
    var settings = rawSettings ? JSON.parse(rawSettings) : null;
    if (safeModeForced) {
      themePreference = "light";
    } else if (settings) {
      var appearance = settings.appearanceSettings || {};
      themePreference = appearance.themeMode === "light" || appearance.themeMode === "dark" || appearance.themeMode === "system"
        ? appearance.themeMode
        : settings.theme === "dark" ? "dark" : settings.theme === "light" ? "light" : "system";
      language = appearance.language === "tr" ? "tr" : "en";
      density = appearance.density === "compact" ? "compact" : "comfortable";
      dateStyle = appearance.dateStyle === "numeric" || appearance.dateStyle === "descriptive" ? appearance.dateStyle : "system";
      timeFormat = appearance.timeFormat === "12h" || appearance.timeFormat === "24h" ? appearance.timeFormat : "system";
      accessibility = settings.accessibilitySettings || {};
    }
  } catch {
    themePreference = "system";
  }

  var theme = themePreference === "system" && window.matchMedia
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : themePreference === "dark" ? "dark" : "light";
  var root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.themePreference = themePreference;
  root.dataset.language = language;
  root.dataset.density = density;
  root.dataset.dateStyle = dateStyle;
  root.dataset.timeFormat = timeFormat;
  root.dataset.highContrast = accessibility.highContrast ? "true" : "false";
  root.dataset.reducedMotion = accessibility.reducedMotion ? "true" : "false";
  root.dataset.largerText = accessibility.largerText ? "true" : "false";
  root.dataset.focusRingStrong = accessibility.focusRingStrong ? "true" : "false";
  root.lang = language;
}());
