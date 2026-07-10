# Coolicons License and Attribution Review

## Result

Coolicons Free attribution is source-backed and complete for the Picom notice gate.

## Sources reviewed

- Official repository: https://github.com/krystonschwarze/coolicons
- Official free Figma file linked by the repository: https://www.figma.com/community/file/800815864899415771
- License URL linked by the upstream README: https://creativecommons.org/licenses/by/4.0/
- Upstream creator statement: Kryston Schwarze

The upstream README identifies Coolicons, links the free Figma file, credits Kryston Schwarze, and states that the free icons are licensed under CC 4.0 while linking specifically to Creative Commons Attribution 4.0 International. The repository did not expose a standalone `LICENSE` file when reviewed on 2026-07-11, so Picom links the authoritative license URL rather than fabricating or misattributing an upstream file.

## Picom attribution

`THIRD_PARTY_NOTICES.md` records:

- project and free-source identity,
- repository and Figma source links,
- creator,
- CC BY 4.0 license link,
- Picom usage,
- SVG/component normalization modifications,
- explicit exclusion of Coolicons PRO without a separate license.

The notice does not grant rights to Iconix, proprietary UI kits, fonts, Coolicons PRO, or unrelated assets. Those assets require their own verified terms.

## Working-tree preservation

An existing user-owned Iconix notice change was already present before Task 418. It was preserved and not included in the Task 418 commit. Coolicons attribution was merged into the working copy so local license checks can run without discarding that work; the committed base already contained the required Coolicons notice.

## Release conclusion

The automated notice gate may pass based on the verified Coolicons attribution. Final overall legal approval remains a separate authorized-review blocker and is not implied by this technical attribution review.

