# Picom Desktop — custom NSIS include (electron-builder)
#
# Wired from electron-builder.yml:
#   nsis.include: assets/installer/windows/installer-custom.nsh
#   nsis.license: assets/installer/windows/license.html (+ license_en / license_tr)
# Languages (English + Turkish) are selected via displayLanguageSelector.
# License acceptance checkbox is provided by the NSIS MUI license page.

!ifndef PICOM_INSTALLER_CUSTOM
!define PICOM_INSTALLER_CUSTOM

; Finish-page site link (in addition to the license accept page).
; Keep in sync with docs/installer/legal-links.json (https://picom.gg).
!define MUI_FINISHPAGE_LINK "Visit picom.gg"
!define MUI_FINISHPAGE_LINK_LOCATION "https://picom.gg"

; Keep installer identity aligned with productName / shortcutName.
!macro customHeader
  !ifdef HEADER_ICO
    ; electron-builder already injects installer icons from electron-builder.yml
  !endif
!macroend

; Optional hook after files are installed (no elevation / no silent network).
!macro customInstall
  DetailPrint "Picom Desktop files installed."
!macroend

!macro customUnInstall
  DetailPrint "Picom Desktop files removed."
!macroend

!endif
