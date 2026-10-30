# Decision log

- v0.1: lightweight local/backend starter; ads, analytics and premium allowed by policy but integrations OFF.
- v0.2: fix stale file-processing results, rebuild local preview on each run, add real-browser test, document Windows `.cmd` commands, replace unreviewed token-bearing preview deploy with a safe preflight only. Do not edit Recorte.
- Pending: lock preview publisher dependencies, bind tested artifact to deploy, add security scanners, validate a second distinct utility, and obtain independent review before calling this production-ready.

- 2026-10-26 / Issue #10: owner authorized Codex to create the isolated product
  branch `codex/product-1-audio-to-mp3` from
  `e5e88173b84804cca4d749f79b99065c37b2020c`, implement the local audio product,
  test, commit, push and open a review PR in hcbar/microtool-starter. This never
  authorizes merge into starter main, deploy, repository creation, credentials,
  ruleset changes, DRY_RUN changes, infrastructure or any Recorte access.
- Single-thread pinned FFmpeg.wasm passes real MP3 encoding in Chromium. Keep
  core download lazy and same-origin, honest indeterminate stage progress,
  terminate the entire worker for cancellation/cleanup. No SharedArrayBuffer.
- GPL core is not MIT. Review may proceed with explicit source/commercial
  distribution blockers; publication cannot. See `codec-licenses.md`. Astra
  review remains pending; implementer checks are not independent review.
