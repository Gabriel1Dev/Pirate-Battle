# Pirate Battle: repository instructions

## Source of truth and timebox

- The root `README.md` is the full challenge specification. Read the relevant
  sections before making changes and keep its requirements consistent.
- The user has two days to complete the challenge. Prioritize a working,
  demonstrable, deployable core, then complete integration, accessibility,
  automated coverage, and documentation. Avoid unrelated refactors and
  unnecessary abstractions. Surface blockers early.
- Work incrementally, one module or cohesive feature at a time. Preserve
  existing user changes and do not edit files outside the requested scope.

## Language, stack, and code quality

- All source code, identifiers, UI text, comments, and project documentation
  must be in English.
- Use strict TypeScript. Do not use `any`; avoid non-null assertions unless
  their safety is justified.
- Use the required stack effectively: React for menus/forms/panels/dialogs;
  PixiJS for the arena and game visuals; TanStack Query and Axios for ranking
  and history; MSW for API mocks in development, tests, and production;
  Playwright for E2E and visual regression; Zustand for UI state; Vite to build.
- Do not add libraries without asking. Prefer existing project patterns.
- Keep changes precise, complete, and focused. Run relevant type checks, lint,
  builds, and tests after changes.

## Architecture

1. `src/game/sim/` is pure TypeScript: no PixiJS, React, DOM, `Date.now`, or
   `Math.random`. Simulation state is plain serializable data. Use a seeded
   mulberry32 RNG whose state is stored in the game state.
2. Use a fixed 1/60-second simulation step with an accumulator. Gameplay must
   not depend on render frame rate.
3. `src/game/render/` reads simulation state and draws it with PixiJS; it never
   owns or changes game rules.
4. `src/game/input/` converts keyboard and touch input into `InputState`.
   Capture gameplay keys only while the gameplay context is active.
5. React must not re-render every game frame. Synchronize HUD/UI state through
   a store at about 10 Hz or only when relevant state changes.
6. Put every gameplay tuning value in typed `src/game/config.ts`, with no magic
   numbers in systems. Document limits. Deep-copy a config snapshot at match
   start so later option changes do not affect an active match.
7. Keep simulation systems separate (movement, AI, weapons, projectiles,
   collisions, spawning, scoring) and call them in a fixed order from `step`.
8. Make Pixi initialization safe under React Strict Mode: handle async
   cancellation and clean up tickers, listeners, timers, entities, and owned
   textures on unmount and restart.
9. Manual pause, window blur, and hidden-page changes freeze all simulation
   time, cooldowns, and spawns. Resume only after a player action; discard
   accumulated time and inputs from the paused period.
10. Expose a test-only `window.__game` hook for reading state and controlling
    simulation time/seed without bypassing actual game rules or rendering.

## Required gameplay

- Build a top-down naval shooter with a bounded arena and blocking islands.
- The player can move forward, rotate both ways, and fire a front weapon or
  three-projectile left/right broadsides, including while moving.
- Include Chaser and Shooter enemies. Chasers pursue and self-destruct on
  player collision without awarding a point; Shooters approach and fire within
  configured range. Both collide with islands and take damage.
- Spawn enemies at configured intervals on free positions safely far from the
  player. Player attacks award one point per enemy destroyed.
- Projectiles obey configured direction, speed, damage, cooldown, and range or
  lifetime; each hit applies once. Remove projectiles on impact, obstacle,
  expiry, or leaving the arena. Destroyed enemies cannot attack or collide.
- End matches on configured time (60–180 active seconds) or player death.
  Ended matches cannot move, attack, deal damage, spawn, or score. Restart
  creates a fresh match.
- Show score, remaining time, and health above ships. Include visible combat
  feedback and ship damage states.

## UI, persistence, APIs, and mocks

- Implement menu, Options, gameplay, result, Ranking, and Match History flows
  from the README. Options expose match duration and enemy spawn interval,
  validate against documented limits, persist locally, and apply only to new
  matches.
- Persist the last completed result and local options. Abandoned matches are
  not submitted.
- Use typed API contracts and Axios with TanStack Query for paginated ranking
  and player history. Handle loading, empty, errors, background refetch,
  caching, invalidation, and retries. Stale responses must not replace newer
  data. API failures must never block gameplay, Options, or the menu.
- Save a completed match locally as PENDING before sending it. Use a client
  `matchId`; MSW must upsert idempotently so retries or repeated clicks cannot
  duplicate history/ranking entries. Pending submissions survive refresh and
  can retry while another match can start.
- Include deterministic MSW scenarios for success, empty/paginated data, slow
  and variable/out-of-order responses, timeout, HTTP/network errors,
  ranking/history failures, timeout-after-save, and offline-on-finish, plus a
  UI/query-param selector and reset.
- Ranking sort order is score descending, duration ascending, date ascending,
  then `matchId`; compare only matching configurations.
- Store UI state in Zustand. Keep semantic status announcements change-based,
  not per-frame.

## Accessibility, testing, delivery

- Support desktop and mobile, keyboard-accessible menus, visible focus,
  labelled controls, focus management/trapping in dialogs, adequate contrast,
  semantic game status, and usable touch controls. Keep the console free of
  unhandled errors.
- Add Playwright E2E and visual regression coverage for the README's critical
  flows, using deterministic seeds and controllable simulation time. Run core
  flows in Chromium desktop and mobile.
- Use supplied assets in `public/assets/`; show asset loading progress/failure
  and allow retry. Keep aspect ratio, input coordinates, and arena bounds
  consistent when resizing.
- Document architecture decisions in root `ARCHITECTURE.md`. Ensure the
  solution runs from a clean checkout, includes setup/test instructions, and
  deploys publicly with MSW active in the production build.
