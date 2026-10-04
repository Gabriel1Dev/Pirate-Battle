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
the gameplay screen unmounts and is not included in normal production builds.
The separate `performance` build mode includes this hook only for profiling;
its assets are written to `dist-performance/`, leaving the deployable `dist/`
untouched.

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
It tiles the supplied ocean texture across the arena and builds each island
from a larger, irregularly masked island sprite, a shallow-water shoreline,
varied foliage, shoreline rocks, and a decorative cannon. The shore masks use
the configured island radii, preserving the simulation's circular collision
footprint. Supplied ship sprites and player/enemy health-bar frame and fill
sprites are loaded locally. Shot, hit, and destruction events drive transient
Pixi effects using the supplied fire and explosion textures; each destroyed
ship also leaves a life boat, survivors, and separated wood debris that gently
drift, fade, and expire. Cannonballs use the supplied cannon-ball sprite, with
short, subtle trails tinted by their owner. The renderer consumes each state's
one-shot events only once. The React HUD and touch/action buttons use the supplied health,
round-button, and icon assets while remaining semantic, accessible controls.
Asset loading reports texture completion progress to the React loading
overlay, then marks the renderer ready after Pixi initialization.

## Configuration and current scope

Gameplay tuning belongs in `src/game/config.ts`; simulation systems read those
values from the per-match deep-copied config. The renderer uses config only for
arena dimensions and visual thresholds. `OptionsScreen` validates the match
duration and spawn interval against the limits in the config module. The
versioned options record is stored in localStorage by `src/store/optionsStorage.ts`;
invalid or unavailable storage is surfaced in the UI instead of being treated
as a successful save. Starting a match snapshots the saved options into a
`GameConfig`, and later changes cannot affect that running match.

Each new match receives a client-generated `matchId`. On completion by time or
player death, `GameScreen` creates a result from the final simulation state and
passes it to `src/store/matchStorage.ts`. That module stores a versioned record
containing the local `playerId`, completion timestamp, score, active duration,
end reason, and full match-config snapshot. It is written with
`submissionStatus: "pending"` before network submission. Axios and TanStack
Query submit the record with its match ID as an idempotency key; successful
responses mark it `confirmed` locally, while failures retain it for an
automatic retry after refresh or a manual menu retry. Abandoned matches are
not recorded. API and storage errors are surfaced without preventing gameplay.

`src/api/contracts.ts` defines the shared record and pagination contracts.
`src/api/matches.ts` contains the Axios requests; `src/api/queries.ts` owns
query keys, caching, retries, and ranking/history invalidation after submission.
Ranking is filtered by the full serialized match config and ordered by score
descending, duration ascending, date ascending, then match ID. History is
scoped to the local player ID. The menu shows both queries with pagination,
loading, empty, error, retry, and background-refresh states.

`src/mocks/handlers.ts` provides the same ranking, history, and idempotent
submission endpoints in development and production. Mock submissions persist
in localStorage. The menu's network selector configures reproducible success,
empty, paginated, latency, timeout, HTTP error, endpoint failure,
timeout-after-save, and offline-on-finish scenarios; it is also controlled by
the `scenario` query parameter. Reset clears the scenario and mock server
records, but intentionally retains the player's local pending queue.

`playwright.config.ts` runs browser tests in Chromium desktop and mobile
profiles. `e2e/game.spec.ts` covers options persistence, seeded movement and
combat/spawn behavior, island and arena-boundary blocking, match end on player
death and timer, manual and focus-loss pause, clean restart, mobile touch
controls, asset retry, hit damage, weapon cooldown, score uniqueness, abandoned
matches, persisted results, pending upload recovery, timeout-after-save
idempotency, delayed response ordering, and ranking pagination plus
empty/failure scenarios. `e2e/visual.spec.ts` compares the menu, paused
arena, and completed result against versioned screenshots in
`e2e/__screenshots__/`. The normal `npm run test:e2e` command compares
baselines; update them intentionally with `npm run test:e2e:update`. Playwright
stores HTML reports and failure traces under ignored output directories.
`npm run test:profile` builds an optimized profile variant and measures frame
pacing, active simulation entity counts, and twenty game mount/unmount cycles.
See `TEST_REPORT.md` and `PERFORMANCE.md` for the latest evidence. The normal
production build and preview were validated, including MSW startup and match
submission through the ranking and history APIs. `vercel.json` configures
Vercel to build with `npm run build` and serve `dist`; the public deployment is
https://pirate-battle-navy.vercel.app/.