# Architecture

## Game and PixiJS boundary

`src/game/sim/` is deterministic TypeScript that owns match state and rules.
The PixiJS scene in `src/game/render/pixiRenderer.ts` only reads that state and
updates display objects. `GameScreen` owns the lifecycle bridge: it advances
the simulation from the Pixi ticker, reads keyboard/touch input, and publishes
small HUD snapshots through Zustand at roughly 10 Hz.

The simulation uses a fixed timestep and accumulator. Pause and resume are
state transitions; pausing clears accumulated time and input so the paused
period cannot be simulated after resuming. The Pixi application and input
listeners are disposed when the gameplay screen unmounts. Ship textures use
the supplied local PNG assets and are loaded before the canvas is exposed as
ready.

In development, `window.__game` exposes copied state, input injection, reset,
and manual-clock controls for deterministic browser tests. It is removed when
the gameplay screen unmounts and is not included in production.

## Simulation lifecycle and systems

`createInitialGameState` in `src/game/sim/world.ts` deep-copies the selected
configuration, creates the player and islands, and stores the normalized seed
as the starting RNG state. `nextRandom` in `src/game/sim/rng.ts` advances the
Mulberry32 generator without using ambient randomness.

The Pixi ticker supplies elapsed frame time to `advanceGame`. The accumulator
caps long frame deltas and calls `stepGame` only at the configured fixed
timestep. Each step clones the incoming state, then updates systems in this
order:

1. Player movement and collision with arena bounds/islands.
2. Player weapon cooldowns and front/broadside projectile creation.
3. Enemy steering, Shooter firing, and deterministic spawn attempts.
4. Projectile movement and earliest collision against islands or ships.
5. Chaser/player contact damage and match-ending checks.

Projectile hits remove the projectile in the same step. Player-caused enemy
destruction awards the configured score; a Chaser that collides with the
player is removed without awarding points. A finished state is returned
unchanged by later simulation advances.

## Input, UI state, and pause

`src/game/input/keyboard.ts` translates W/Up, A/D, Space, and Q/E to
`InputState`; input is cleared on blur, pause, and teardown. Editable and
interactive controls are excluded from gameplay key handling. The touch
buttons in `GameScreen` set and release the same input fields, allowing
movement and firing at once.

Zustand stores only the HUD snapshot. React receives updates at approximately
10 Hz; the simulation and entity state remain outside React render state.
Manual pause, browser blur, and hidden-page events change the simulation to
paused, clear its accumulator and inputs, and require a player action to resume.

## PixiJS lifecycle and rendering

`GameScreen` asynchronously initializes the Pixi application and local ship
textures. A cancelled initialization destroys an application that completes
after unmount. The ticker and keyboard/browser listeners are removed on
teardown, and the application is destroyed with its display objects. The
development test hook is removed at the same lifecycle boundary.

The renderer scales and centers the logical arena within the available canvas.
At present, islands are drawn as simple circles and projectiles as colored
circles; supplied ship sprites are loaded locally. Water tile textures,
effects, richer health-bar assets, and progress reporting are still pending.

## Configuration and current scope

Gameplay tuning belongs in `src/game/config.ts`; simulation systems read those
values from the per-match deep-copied config. The renderer uses config only for
arena dimensions and visual thresholds. Options UI and local options
persistence have not been implemented.

The current implementation does not yet include the complete menu/options and
result flows, local result persistence, ranking/history contracts and queries,
Axios integration, MSW handlers/scenarios, automated Playwright tests, or
deployment. Those are outstanding challenge requirements, not behaviors to
assume from the current build. When added, keep API failures isolated from
gameplay and persist completed-match submissions as pending before network
requests so retries can be idempotent.