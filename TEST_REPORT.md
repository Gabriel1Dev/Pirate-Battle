# Test report

## Latest validation

The latest full E2E run completed with **38 passed and 2 skipped** across 40
Chromium desktop and mobile cases. The skipped cases are expected profile
guards: asset-request retry is desktop-only, and touch controls are
mobile-only.

Commands:

```sh
npm run build
npm run lint
npm run test:e2e
npm run test:profile
```

The E2E suite includes gameplay, options persistence, keyboard and touch input,
pause and lifecycle behavior, combat and scoring, completed and abandoned
match handling, ranking and history requests, upload retries, and visual
baselines. The profile build runs separately and does not replace the normal
production output.

## Production smoke test

The production build was also served with Vite Preview and checked for MSW
startup, game loading, match submission, and the resulting record in both
history and ranking. The public Vercel deployment was checked at
<https://pirate-battle-navy.vercel.app/>.

## Notes

The optimized build reports that the main JavaScript chunk is larger than
500 kB. This is a Vite bundle-size warning, not a test failure; code splitting
is a potential follow-up.

See [PERFORMANCE.md](./PERFORMANCE.md) for the measured frame pacing, entity
counts, and lifecycle heap readings, including their limitations.
