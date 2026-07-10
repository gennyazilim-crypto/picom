# Shared installer sources

This directory contains cross-platform visual direction sources. Files with
`.placeholder.` in their name are not release artwork and must never be
referenced by `electron-builder.yml`.

Current package outputs use original Picom assets from `assets/brand` plus the
reviewed platform-specific files under `assets/installer/windows` and
`assets/installer/macos`.
