# Pirate Battle — Software Design Specification

## 1. Document Overview

### 1.1 Purpose

This document specifies the technical design, architecture, gameplay simulation,
state management, infrastructure integrations, testing strategy, accessibility
requirements, and deployment constraints for Pirate Battle.

### 1.2 Scope

This specification covers the implementation of the Pirate Battle application,
including:

- React-based presentation and UI flows.
- PixiJS-based game rendering.
- TypeScript game simulation.
- Keyboard and touch input.
- Game state and configuration management.
- Ranking and match history integrations.
- Axios and TanStack Query data access.
- MSW API mocking.
- Local persistence and pending submission recovery.
- Playwright end-to-end and visual regression testing.
- Accessibility, performance, and deployment requirements.

### 1.3 Source of Truth

The root `README.md` is the complete challenge specification.

The implementation described in this document must remain consistent with the
requirements defined in the `README.md`.

### 1.4 Development Constraints

The implementation is timeboxed to two days.

Development priorities are:

1. Working, demonstrable, and deployable core gameplay.
2. Required integrations.
3. Accessibility.
4. Automated test coverage.
5. Documentation.

Unrelated refactors and unnecessary abstractions should be avoided.
Blockers should be surfaced early.

Development should proceed incrementally, one module or cohesive feature
at a time. Existing user changes must be preserved, and files outside the
requested scope must not be modified.

## 2. Technical Requirements

### 2.1 Language and Code Quality

The project must follow these requirements:

- All source code, identifiers, UI text, comments, and documentation must be written in English.
- TypeScript must use strict mode.
- `any` must not be used.
- Non-null assertions should be avoided unless their safety is justified.
- Changes must be precise, complete, and focused.
- Relevant type checks, linting, builds, and tests must be executed after changes.

### 2.2 Technology Stack

The project uses:

| Concern | Technology |
|---|---|
| UI and menus | React |
| Game rendering | PixiJS |
| Remote ranking and history state | TanStack Query |
| HTTP client | Axios |
| API mocking | MSW |
| E2E and visual regression | Playwright |
| UI state | Zustand |
| Build tool | Vite |

No additional libraries should be introduced without approval.
Existing project patterns should be preferred.

# 3. System Architecture

## 3.1 Architectural Overview

The system separates presentation, application coordination, domain
simulation, rendering, input handling, and infrastructure concerns.

The architecture must preserve a clear separation between:

- React presentation and UI state.
- Application-level use case coordination.
- Game simulation and gameplay rules.
- PixiJS rendering.
- User input.
- External APIs and persistence.

## 3.2 Simulation Layer

The simulation layer is located under:

```text
src/game/sim/
```

This layer must contain pure TypeScript and must not depend on:

- PixiJS.
- React.
- DOM APIs.
- `Date.now()`.
- `Math.random()`.

Simulation state must consist of plain serializable data.

Randomness must use a seeded `mulberry32` random number generator whose
state is stored as part of the game state.

## 3.3 Rendering Layer

The rendering layer is located under:

```text
src/game/render/
```

The rendering layer:

- Reads simulation state.
- Renders the game state using PixiJS.
- Must not own gameplay rules.
- Must not modify gameplay rules.

## 3.4 Input Layer

The input layer is located under:

```text
src/game/input/
```

It converts keyboard and touch input into `InputState`.

Gameplay keys must only be captured while the gameplay context is active.

## 3.5 React Integration

React must not re-render on every game frame.

HUD and UI state must be synchronized through a state store at approximately
10 Hz or only when relevant state changes.

## 3.6 Gameplay Configuration

All gameplay tuning values must be defined in:

```text
src/game/config.ts
```

The configuration must:

- Be typed.
- Avoid magic numbers inside gameplay systems.
- Document applicable limits.
- Be deep-copied into a configuration snapshot when a match starts.

Changes to options after a match starts must not affect the active match.

## 3.7 Simulation Systems

Simulation systems must remain separated by responsibility.

The required systems include:

- Movement.
- AI.
- Weapons.
- Projectiles.
- Collisions.
- Spawning.
- Scoring.

These systems must execute in a fixed order from `step`.

## 3.8 PixiJS Lifecycle

PixiJS initialization must be safe under React Strict Mode.

The implementation must correctly handle:

- Asynchronous cancellation.
- Ticker cleanup.
- Listener cleanup.
- Timer cleanup.
- Entity cleanup.
- Owned texture cleanup.

Cleanup must occur during unmount and restart.

## 3.9 Pause and Resume

Manual pause, window blur, and hidden-page changes must freeze:

- Simulation time.
- Cooldowns.
- Spawning.

Resuming requires a player action.

Accumulated time and inputs from the paused period must be discarded.

## 3.10 Test Hook

A test-only hook must be exposed through:

```text
window.__game
```

The hook must allow tests to:

- Read game state.
- Control simulation time.
- Control the simulation seed.

The hook must not bypass actual game rules or rendering.

# 4. Gameplay Design

## 4.1 Game Overview

The game is a top-down naval shooter with:

- A bounded arena.
- Blocking islands.
- A player-controlled ship.
- Chaser enemies.
- Shooter enemies.
- Projectiles.
- Scoring.
- A configurable match duration.

## 4.2 Player

The player must be able to:

- Move forward.
- Rotate in both directions.
- Fire a front weapon.
- Fire three-projectile left and right broadsides.
- Move and fire simultaneously.

## 4.3 Chaser

The Chaser:

- Pursues the player.
- Causes damage when colliding with the player.
- Self-destructs on player collision.
- Does not award a point when it self-destructs against the player.

## 4.4 Shooter

The Shooter:

- Approaches the player.
- Fires when the player is within its configured attack range.
- Collides with islands.
- Takes damage.

## 4.5 Enemy Spawning

Enemies must spawn:

- At configured intervals.
- At free positions.
- At positions safely far enough from the player to prevent unavoidable
  immediate damage.

## 4.6 Projectiles

Projectiles must respect configured:

- Direction.
- Speed.
- Damage.
- Cooldown.
- Range or lifetime.

Each projectile hit must apply damage only once.

Projectiles must be removed when they:

- Hit a target.
- Hit an obstacle.
- Expire.
- Leave the arena.

Destroyed enemies must no longer:

- Attack.
- Cause damage.
- Participate in collisions.

## 4.7 Match Lifecycle

A match ends when:

- The configured match time expires, between 60 and 180 active seconds.
- The player dies.

After a match ends, the simulation must no longer:

- Move entities.
- Perform attacks.
- Deal damage.
- Spawn enemies.
- Increase the score.

Restarting a match must create a fresh match.

## 4.8 Scoring

Player attacks award one point for each enemy destroyed.

A Chaser that self-destructs against the player does not award a point.

## 4.9 HUD and Combat Feedback

The game must display:

- Score.
- Remaining time.
- Health above ships.

Combat must provide visible feedback and ship damage states.

# 5. User Interface

## 5.1 Required UI Flows

The application must provide:

- Main menu.
- Options.
- Gameplay.
- Result.
- Ranking.
- Match History.

## 5.2 Options

The Options screen must expose:

- Match duration.
- Enemy spawn interval.

Options must:

- Be validated against documented limits.
- Persist locally.
- Apply only to new matches.

## 5.3 UI State

UI state must be managed through Zustand.

Semantic status announcements must be change-based rather than generated
on every game frame.

# 6. State and Persistence

## 6.1 Local Persistence

The system must persist:

- Player options.
- The last completed match result.

Abandoned matches must not be submitted.

## 6.2 Match Submission State

A completed match must be saved locally as:

```text
PENDING
```

before being sent to the API.

Each match must receive a client-generated:

```text
matchId
```

Pending submissions must survive page refreshes and remain retryable.

A player must be able to start another match while a previous submission
is still pending.

## 6.3 Idempotency

MSW must upsert records by `matchId`.

Retries and repeated submission actions must not create duplicate:

- History entries.
- Ranking entries.

# 7. API and Data Architecture

## 7.1 API Contracts

API contracts must be typed.

Axios must be used as the HTTP client.

TanStack Query must manage ranking and match history data.

## 7.2 Ranking

The ranking API must support paginated ranking data.

Ranking entries must be ordered by:

1. Score descending.
2. Duration ascending.
3. Date ascending.
4. `matchId`.

Only matches using the same configuration should be compared.

## 7.3 Match History

The match history API must provide paginated history for the player.

## 7.4 TanStack Query Requirements

The implementation must handle:

- Loading states.
- Empty states.
- Errors.
- Background refetching.
- Caching.
- Invalidation.
- Retries.

Stale responses must not replace newer data.

API failures must never block:

- Gameplay.
- Options.
- Main menu access.

# 8. MSW and Network Scenarios

## 8.1 Mocking Architecture

MSW must provide API mocks for development, testing, and production.

The mocks must use deterministic and reproducible scenarios.

## 8.2 Required Scenarios

The following scenarios must be available:

- Success.
- Empty data.
- Paginated data.
- Slow responses.
- Variable latency.
- Out-of-order responses.
- Timeout.
- HTTP errors.
- Network errors.
- Ranking failure.
- Match history failure.
- Timeout after save.
- Offline at match completion.

## 8.3 Scenario Selection

The application must provide:

- A UI selector for network scenarios.
- A query-parameter representation of the selected scenario.
- A reset operation.

# 9. Accessibility and Responsive Design

## 9.1 Accessibility

The application must support:

- Keyboard-accessible menus.
- Visible focus.
- Labelled controls.
- Focus management and trapping in dialogs.
- Adequate contrast.
- Semantic game status.
- Usable touch controls.

The console must remain free of unhandled errors.

## 9.2 Desktop and Mobile

The application must support:

- Desktop.
- Mobile.
- Keyboard input.
- Touch input.

## 9.3 Assets

Supplied assets must be used from:

```text
public/assets/
```

The application must provide:

- Visible asset loading progress or failure state.
- Asset loading retry.

## 9.4 Responsive Rendering

Resizing must preserve:

- Aspect ratio.
- Input coordinates.
- Arena bounds.

# 10. Testing Strategy

## 10.1 End-to-End Testing

Playwright must provide E2E coverage for critical README-defined flows.

## 10.2 Visual Regression

Visual regression tests must cover the required UI and gameplay flows.

## 10.3 Deterministic Testing

Tests must use:

- Deterministic seeds.
- Controllable simulation time.

## 10.4 Browser Coverage

Core flows must run in:

- Chromium desktop.
- Chromium mobile.

# 11. Deployment

The solution must:

- Run from a clean checkout.
- Include setup instructions.
- Include test instructions.
- Deploy publicly.
- Keep MSW active in the production build.

# 12. Architectural Constraints

The following constraints are mandatory:

1. The simulation must remain independent from React, PixiJS, and the DOM.
2. Gameplay must not depend on render frame rate.
3. React must not re-render every simulation frame.
4. Gameplay configuration must be centralized in `src/game/config.ts`.
5. Gameplay systems must remain separated by responsibility.
6. PixiJS must only be responsible for rendering and related lifecycle management.
7. Gameplay input must only be captured in the active gameplay context.
8. Paused simulation time and inputs must not accumulate.
9. Match submissions must be idempotent.
10. API failures must not prevent gameplay.

# 13. Implementation and Change Management

Development must proceed incrementally and preserve the existing architecture.

Changes must:

- Remain within the requested scope.
- Avoid unrelated refactors.
- Avoid unnecessary abstractions.
- Preserve existing user changes.
- Follow established project patterns.

Relevant validation must be performed after implementation changes, including
type checks, linting, builds, and applicable tests.

# 14. Architecture Documentation

The architectural decisions described by this specification must be documented
in the root:

```text
ARCHITECTURE.md
```

The architecture documentation must remain consistent with this specification
and the requirements defined in `README.md`.

# 15. Architectural Boundaries

The following boundaries must remain explicit:

```text
React
  │
  ▼
Application / Use Cases
  │
  ▼
Game Domain / Simulation
  │
  ├── Rendering → PixiJS
  ├── Input → Keyboard / Touch
  └── Infrastructure → Axios / TanStack Query / MSW / Local Storage
```

The game simulation remains the authoritative source for continuous gameplay
state.

React consumes synchronized state for presentation and UI purposes rather
than owning per-frame simulation state.
