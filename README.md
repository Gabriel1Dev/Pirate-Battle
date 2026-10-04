### Requirements

- Node.js 20.19+ or 22.12+
- npm

### Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite to play. Available validation commands:

```sh
npm run build
npx tsc -b --pretty false
npm run lint
npm run test:e2e
npm run test:profile
npm run preview
```

`npm run build` performs the TypeScript project build before creating the Vite
production bundle. Install the Playwright Chromium browser once with
`npx playwright install chromium`. `npm run test:e2e` runs the suite against
Chromium desktop and a mobile Chromium profile and writes the HTML report to
`playwright-report/`; open it with `npm run test:e2e:report`. To intentionally
replace screenshot baselines after reviewing a visual change, use
`npm run test:e2e:update`.

`npm run test:profile` creates a separate optimized profiling build, serves it
with Vite Preview, and records frame pacing, three-minute match entity counts,
and heap readings across twenty start/exit cycles. The profile-only test hook is
not included in the normal production build. Profiling output and the written
measurements are documented in `PERFORMANCE.md`.

### Implemented gameplay

- Start, play, pause, resume, restart, and return to the main menu.
- Move forward and turn with **W/Up**, **A**, and **D**.
- Fire the front cannon with **Space** and left/right broadsides with **Q/E**.
- On touch screens, use the six on-screen buttons for the same actions.
- Sink enemies for points, avoid Chaser collisions and Shooter projectiles, and
  survive until the match timer expires.

The current build includes the seeded simulation, fixed-step clock, enemy
spawning and combat, circular island obstacles, PixiJS rendering, ship health
bars, combat effects, a throttled HUD, and a persisted Options screen. Use
**Options** from the main menu to set the game session time (60–180 whole
seconds) and enemy spawn time (1–10 whole seconds). Saved options are restored
after refresh and copied into a configuration snapshot when a new match starts;
changes affect future matches only. Defaults are 90 seconds per match and 3
seconds between spawns. Game tuning and limits are defined in
`src/game/config.ts`.

Each match receives a client-generated ID. On time or player death, its score,
active duration, end reason, completion time, and full config snapshot are
saved to localStorage as a pending submission before upload. Axios submits the
record through TanStack Query to the MSW-backed API, which upserts by match ID;
confirmed records are marked locally and pending records are retried after
refresh or with the menu retry action. API errors never block gameplay.

Use **Ranking** and **Match History** from the main menu to browse paginated
API results. Ranking entries are filtered to the exact current match config and
ordered by score descending, duration ascending, completion date ascending,
then match ID. Fixture players populate the ranking. The **Network demo**
selector in the menu exposes success, empty, pagination, latency, timeout,
HTTP error, per-endpoint failure, timeout-after-save, and offline-on-finish
scenarios. Selecting a scenario also updates the `scenario` query parameter;
**Reset mock data** restores the success scenario and clears mock-server data.
The mocks run in development and production and persist accepted mock matches
locally in the browser.

Playwright currently covers options persistence, deterministic movement and
combat/spawning, island and arena-boundary blocking, match end on player death,
manual and focus-loss pause, fresh-match behavior, mobile touch controls,
asset load retry, combat damage/cooldowns/scoring, end by timer, abandoned
matches, result persistence across refresh, pending upload recovery,
timeout-after-save idempotency, delayed ranking responses, and pagination plus
empty/failure scenarios. Visual baselines cover the menu, paused arena, and
completed result on both viewports; they are stored under
`e2e/__screenshots__/`. Test traces and failure artifacts are written under the
ignored `test-results/` directory. The latest validation results and the
profiling conditions are recorded in `TEST_REPORT.md` and `PERFORMANCE.md`.
The production preview also confirmed that MSW starts, a completed match is
submitted once, and its record appears in history and ranking.

### Deploy to Vercel

The repository includes `vercel.json` with the Vite build command and `dist`
output directory. The public deployment is
https://pirate-battle-navy.vercel.app/. No environment variables or external API
credentials are required: ranking and history are served by MSW in the
production build. After pushing changes, verify the updated deployment at that
URL.

In development, `window.__game` can read a copied simulation state, set the
current input, advance a deterministic amount of simulation time, reset with a
seed, or switch back to the real-time clock. The hook is also enabled in the
separate performance profile build for reproducible entity counts; it is
omitted from normal production builds.

## Project architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the simulation/rendering boundary,
fixed-step lifecycle, input handling, pause behavior, current limitations, and
the planned integration boundaries for features not implemented yet.
See [copilot-instructions.md](./.github/copilot-instructions.md) for the project's System Design Specification (SDD), defining its architecture, technical requirements, coding conventions, and operational context for integration with generative AI models and AI-powered development agents. See the GitHub README for the project overview.
