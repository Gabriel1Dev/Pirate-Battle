# Performance profile

## Reproduce

Run `npm run test:profile`. This builds an optimized, separate Vite output in
`dist-performance/`, serves it with `vite preview`, and runs the Chromium
desktop profiling scenario in `e2e/performance.spec.ts`. The profile-only
`window.__game` hook is enabled by Vite's `performance` mode; the regular
production build in `dist/` does not expose it.

The profiler captures a five-second requestAnimationFrame sample at 1280×720,
advances one seeded 180-second match in fixed simulation time, and then
measures JavaScript heap usage after twenty 1.5-second gameplay mount/unmount
cycles. The match uses the Options screen's maximum spawn interval of 10
seconds, and continuously moves, turns, and fires. Entity counts include the
player, enemies, and projectiles.

## Latest measurement

Recorded 2026-10-03 on the local reference environment:

| Metric | Result |
| --- | --- |
| OS | Windows 10 Pro, build 19045 |
| CPU | Intel Core i5-10400F, 6 cores |
| System RAM | 16 GB |
| GPU | NVIDIA GeForce GTX 1650 |
| Browser | Playwright Chromium 153.0.8010.12 |
| Rendering backend | ANGLE / Direct3D 11 on GeForce GTX 1650 |
| Viewport | 1280×720 CSS pixels, DPR 1 |
| Build | Vite optimized `performance` mode |
| Sampled requestAnimationFrame rate | 59.2 FPS |
| Frame interval p95 | 16.8 ms |
| Simulated match | 180 seconds, ended by time |
| Maximum enemies | 11 |
| Maximum projectiles | 9 |
| Maximum total game entities | 19 |
| JavaScript heap after cycles 1–20 | 9.42, 9.62, 9.76, 9.90, 10.01, 10.09, 10.19, 10.55, 10.63, 10.73, 10.86, 10.92, 10.99, 11.07, 11.15, 11.22, 11.30, 11.38, 11.46, 11.52 MiB |

The frame-rate sample met the 60 FPS target on this machine with hardware
acceleration enabled. The heap increased by about 2.11 MiB across twenty
teardown/recreation cycles, without reaching a plateau. Audio teardown now
releases the media sources explicitly, but a repeat profile showed a similar
increase; this measurement alone does not identify the retaining objects or
prove a leak. Investigate with heap snapshots before claiming memory stability.

## Limitations

This is a local browser profile, not a guarantee for lower-end devices. The
frame sample uses requestAnimationFrame cadence as a proxy for presented FPS;
it is not a GPU frame-capture or input-to-photon measurement. Heap values come
from Chromium's CDP `Runtime.getHeapUsage` and include JavaScript heap only.
They do not account for GPU texture/render-target memory, browser process
overhead, or total system memory. The lifecycle check samples twenty short
start/exit cycles and is a leak smoke test, not a long-duration soak test or a
heap-retainer analysis.

The Playwright HTML profile report is written to the ignored
`playwright-profile-report/` directory. Re-run `npm run test:profile` to
regenerate it for another hardware/browser configuration.
