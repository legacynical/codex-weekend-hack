# Blender navigation gizmo reference

Researched: 2026-05-02T23:39:00-07:00
Expires: 2027-05-02
Confidence: medium

## Sources

- [Blender 4.5 LTS Manual: 3D Viewport navigation introduction](https://docs.blender.org/manual/en/latest/editors/3dview/navigate/introduction.html)
- [Blender 4.2 LTS Manual: Viewport Gizmos](https://docs.blender.org/manual/en/4.2/editors/3dview/display/gizmo.html)
- [Blender source browser: generic gizmo library declarations](https://projects.blender.org/archive/blender-archive/src/commit/b3625e6bfda3d5c16367ddd34f897e911d669fa8/source/blender/editors/include/ED_gizmo_library.h)

## Findings

- Blender places the navigation gizmo in the top-right of the 3D viewport.
- The orbit gizmo communicates current camera orientation, supports left-button drag to orbit, and lets users click axis labels to align to that axis. Re-clicking the same axis flips to the opposite side.
- Blender's broader gizmo language uses color-coded axes: X red, Y green, Z blue.
- Blender transform gizmos distinguish axis handles, ring/circle rotation affordances, and direct manipulation targets. For this app, the navigation behavior is the closer reference than object transformation because the user is manipulating the camera view, not the voxel object.

## Product Translation

- The voxel viewer should prioritize a navigation-gizmo model: drag anywhere on the gizmo orbit control for perspective/free rotation, and click prominent axis/ball targets for signed orthogonal surface views.
- Ball targets should be larger than the current first-pass handles, should replace arrowheads rather than sit behind them, and should show readable `X`, `Y`, `Z` labels above/near the positive-axis balls.
- Orthogonal surface selection must not leave the main canvas in a locked rotation state; after transition animation completes, ordinary viewport drag should still orbit freely.
- The app should not clone Blender source code or GPL implementation details; it should replicate the interaction pattern and visual affordances in its own Three.js implementation.
