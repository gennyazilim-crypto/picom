(function applyPicomThemeBeforeRender() {
  var theme = "light";

  try {
    var safeModeForced = window.localStorage.getItem("picom:safe-mode:forced") === "true";
    var rawSettings = window.localStorage.getItem("picom-settings");
    var settings = rawSettings ? JSON.parse(rawSettings) : null;
    if (!safeModeForced && settings && settings.theme === "dark") theme = "dark";
  } catch {
    theme = "light";
  }

  document.documentElement.dataset.theme = theme;
}());
