# Bounded replacement-codec spike — PR #11

**Decision: FUNCTIONAL_PASS / LICENSE_BLOCK. Do not migrate the product.**

Owner's [bounded authorization](https://github.com/hcbar/microtool-starter/pull/11#issuecomment-6409801470): prototype pinned Mediabunny + MP3 encoder, investigate source correspondence, adopt only if both gates pass. No rebuild, merge, repository creation or deployment. Executor: Codex; base candidate `e645f7a7786612784b08dfb675e1293da9831031`. This is an implementer experiment, not independent review.

## Reproduce

From repository root, install `npm ci --ignore-scripts` and build with `npm run build` for the existing fixture generator. Then:

```sh
npm ci --prefix experiments/mediabunny --ignore-scripts
# Use CPython 3.12 with tests/requirements-browser.txt, and Playwright Chromium.
python3.12 experiments/mediabunny/smoke.py
python3.12 experiments/mediabunny/manifest.py
```

The smoke binds an ephemeral loopback port and serves the repository for local testing only. It deliberately has no production CSP; inline import maps and blob workers are experiment scaffolding. Do not expose this server publicly or copy it into the product. Output: `test-results/mediabunny/smoke.json`. The committed `evidence.json` is a compact snapshot of the actual run, not a substitute for rerunning. FFmpeg only generates the two synthetic P2 fixtures; it is not used in the replacement conversions. No external media or service is used.

## Actual results — 2026-10-26

Pinned `mediabunny@1.62.1` and `@mediabunny/mp3-encoder@1.62.1`, with a separate lockfile; root dependencies/build remain unchanged. Chromium **143.0.7499.4**, Linux x64 desktop: **7/7 pass**. MP4/AAC, M4A/AAC, OGG/Opus, `.opus`, OGG/Vorbis, video 5s/audio 2s, and AAC offset +3s all produced MP3 with one track. Chromium decoded each output, duration 2.038–2.064s and RMS 0.0826–0.0838 (non-silent synthetic 440 Hz tone). Per-conversion measured time 208–648ms; whole conversion loop 2.22s. These are short warm-machine spike timings, not product download latency or benchmarks against FFmpeg.

Observed requests were same-origin static GETs without bodies or local blob URLs. Browser errors and unsupported decoders are retained as failures and cause nonzero exit. The two modules actually imported total **1,020,924 bytes**, or **314,062 bytes** when each is gzip-compressed with Python's default level; worker/glue/WASM are already embedded. This excludes the unchanged application UI, HTML/import-map scaffolding and fixture generator. It is not a production bundle or measured HTTP compressed transfer. Existing FFmpeg core+glue alone are 32,344,223 bytes. Hashes and individual sizes are in `evidence.json`.

No mobile emulation, physical phone, Safari, long-duration, cancellation, malformed-input or memory/CPU benchmark was performed on the replacement. Production CSP `worker-src 'self'` rejects the encoder's blob worker; adopting it requires a reviewed worker packaging/CSP decision. The smoke does not establish that replacement is ready for the existing product's limits or acceptance gates.

## Source inventory and precise remaining blocker

The npm packages include MPL-2.0 text, adapter/worker TypeScript, `src/lame-bridge.c`, and generated `dist/modules/build/lame.js`. They do not include the full LAME C source or its LGPL text. README describes LAME **3.100** and a manual build recipe, but does not pin the source tarball hash, toolchain revision or provide a build record tying that source/recipe to the embedded binary. No manual rebuild was attempted, as required by scope.

The registry's [encoder attestation](https://registry.npmjs.org/-/npm/v1/attestations/@mediabunny%2fmp3-encoder@1.62.1) payload identifies upstream commit **`f630141a4ac2936d00af14bf8ff2c5bb62b66150`** and [release run 39831984029](https://github.com/Vanilagy/mediabunny/actions/runs/39831984029/attempts/1). Its subject SHA512 agrees with the npm integrity recorded in our lockfile. This session decoded the payload; it did **not** independently verify its cryptographic certificate/signature/transparency chain.

The embedded 223,033-byte WASM SHA256 is **`d0b109db83c153b81ba0080fa2163664dff1e341b154edda6d40bc4b6fbc355e`**. Extracting it from the installed module, checking its presence in the actual encoder bundle, and comparing against upstream's [immutable build/lame.js](https://github.com/Vanilagy/mediabunny/blob/f630141a4ac2936d00af14bf8ff2c5bb62b66150/packages/mp3-encoder/build/lame.js) gave identical bytes. Glue files differ after package build; only embedded WASM equality is claimed. Optional `manifest.py /path/to/upstream/lame.js` reproduces the binary comparison.

This establishes an immutable **precompiled artifact match**, not full corresponding-source provenance. The [release workflow](https://github.com/Vanilagy/mediabunny/blob/f630141a4ac2936d00af14bf8ff2c5bb62b66150/.github/workflows/release.yml) builds/packages the JS libraries, without reconstructing LAME from fixed source. The [README](https://github.com/Vanilagy/mediabunny/blob/f630141a4ac2936d00af14bf8ff2c5bb62b66150/packages/mp3-encoder/README.md) explicitly says built WASM artifacts are included in the repository and gives manual source/build instructions.

**LICENSE_BLOCK:** missing verified complete corresponding LAME source/build inventory for this exact binary, complete notices and an independently reviewed LGPL replacement/relinking delivery path for embedded WASM. No finding that upstream cannot supply these, and no legal clearance inferred from MPL package metadata. A source manifest for the adapter alone does not close the LAME gate. Publication remains blocked for the existing FFmpeg candidate too.

Smallest next decision: obtain the existing LAME build's source/toolchain record from its maintainer and review a source+replacement delivery plan. Contacting the maintainer requires explicit authorization to send a message. If that record is unavailable, owner must separately scope a reproducible encoder build or choose another path. This spike authorizes neither rebuild nor adoption after a failed license gate. Independent focal codec/license review remains pending for this delta.
