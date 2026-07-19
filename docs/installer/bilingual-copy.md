# Picom installer bilingual copy (EN / TR)

These strings guide product review for the Windows assisted NSIS installer.
Built-in NSIS MUI supplies most UI chrome; Picom product naming and welcome
intent should stay aligned with this table.

Language selection is enabled in `electron-builder.yml`
(`installerLanguages: en_US + tr_TR`, `displayLanguageSelector: true`).

| Key | English | Türkçe |
| --- | --- | --- |
| Language selector | Please select a language | Lütfen bir dil seçin |
| Welcome title | Welcome to Picom Desktop Setup | Picom Desktop Kurulumuna Hoş Geldiniz |
| Welcome body | Picom is a desktop community workspace for chat, channels, and voice. | Picom; sohbet, kanallar ve ses için masaüstü topluluk çalışma alanıdır. |
| License title | License Agreement | Lisans Sözleşmesi |
| License summary | Beta software; lawful use; mic/capture only on your action; full terms on picom.gg | Beta yazılım; yasal kullanım; mikrofon/yakalama yalnızca sizin işleminizle; tam metin picom.gg |
| Accept checkbox | I agree to the Terms and acknowledge Security & privacy | Kullanım şartlarını kabul ediyor ve güvenlik & gizlilik politikasını onaylıyorum |
| Website | Website | Web sitesi |
| User agreement | User agreement | Kullanıcı sözleşmesi |
| Security & privacy | Security & privacy | Güvenlik ve gizlilik |
| Directory | Choose Install Location | Kurulum Konumunu Seçin |
| Install | Installing Picom Desktop | Picom Desktop kuruluyor |
| Finish title | Completing Picom Desktop Setup | Picom Desktop Kurulumu Tamamlanıyor |
| Finish body | Picom is ready. Launch Picom Desktop. | Picom hazır. Picom Desktop’ı başlatın. |
| Shortcut | Picom Desktop | Picom Desktop |
| Run after finish | Run Picom Desktop | Picom Desktop’ı çalıştır |

## Policies & links

Informational accordion lives in the **right resources rail** of the live
preview. Acceptance checkbox is on the License step only. URLs live in
[`legal-links.json`](legal-links.json) / [`legal-links.md`](legal-links.md).

NSIS shows the MUI license page (`assets/installer/windows/license*.html`) with
an **I Agree** checkbox before directory selection.

## Binding license

Installer acceptance is wired to the public picom.gg Terms / Security pages via
`nsis.license`. See also [`docs/legal/installer-license.md`](../legal/installer-license.md).
