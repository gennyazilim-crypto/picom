# Rounded premium app frame

Task 037 strengthens the desktop app frame without changing the MVP layout.

## Frame rules

- The shell remains a Windows/Linux/macOS desktop viewport, not a responsive mobile layout.
- The four columns keep their fixed/flexible sizing.
- The rounded frame uses design tokens for radius, surfaces, borders, and shadows.
- A subtle ambient halo sits behind the frame to match the premium reference quality while keeping the Picom palette original.

## Manual verification

- Launch the app at 1440x900.
- Confirm the title bar and main frame share the rounded outer shell.
- Confirm sidebars remain fixed and chat scroll remains independent.
- Confirm the frame looks complete in light and dark modes.