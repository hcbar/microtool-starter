# Fixed-revision Mediabunny candidate — local evaluation only

Status: **NOT CLEARED FOR RELEASE**. This experiment evaluates the upstream
source revision `cce92cb0f131f522295dc0797962fb1f5d3c1f44`, which contains
the LAME provenance added for upstream issue #588. Do not use a moving branch.

The latest published package checked 2026-10-30 was v1.64.0, which precedes
that revision. This path does **not** rely on the next npm release; it rebuilds
Mediabunny's JS bundles from the fixed git commit in a local disposable folder.
The included prebuilt LAME WASM should match SHA-256
`a680e507e9d91f1a4dcd6f846b9b94ff1fec7e19ff44e803358c218ddbe446a6`.

## Local reproducible steps (not executed by this file)

Requires Node 22, Git, Python 3.12 and Playwright Chromium per existing test
harness. No API keys, deploy or publishing required.

```bash
# From project root; use a disposable path not tracked in Git:
git clone https://github.com/Vanilagy/mediabunny.git /tmp/mediabunny-fixed
git -C /tmp/mediabunny-fixed checkout cce92cb0f131f522295dc0797962fb1f5d3c1f44
test "$(git -C /tmp/mediabunny-fixed rev-parse HEAD)" = cce92cb0f131f522295dc0797962fb1f5d3c1f44
node experiments/mediabunny/check-pinned-wasm.mjs /tmp/mediabunny-fixed/packages/mp3-encoder/build/lame.js
(cd /tmp/mediabunny-fixed && npm ci --ignore-scripts --no-audit --no-fund && npm run build)

# Existing FFmpeg is used exclusively to generate synthetic fixtures.
npm ci --ignore-scripts --no-audit --no-fund
npm run build
```

The HTTP smoke server serves only files under the repository root. Stage the
bundles temporarily in the ignored directory and use URL paths, not absolute
filesystem paths. The encoder's ESM import uses the import map in the harness.
Do not commit or upload bundles.

```bash
mkdir -p experiments/mediabunny/pinned-build
cp /tmp/mediabunny-fixed/dist/bundles/mediabunny.min.mjs experiments/mediabunny/pinned-build/
cp /tmp/mediabunny-fixed/packages/mp3-encoder/dist/bundles/mediabunny-mp3-encoder.mjs experiments/mediabunny/pinned-build/
MEDIABUNNY_CORE_MODULE=/experiments/mediabunny/pinned-build/mediabunny.min.mjs \
MEDIABUNNY_ENCODER_MODULE=/experiments/mediabunny/pinned-build/mediabunny-mp3-encoder.mjs \
MEDIABUNNY_CANDIDATE_ADAPTER=1 python3.12 experiments/mediabunny/smoke.py
rm -rf experiments/mediabunny/pinned-build
```

The existing 7-case smoke checks real MP3 output, audio tracks, Chromium
decoding and same-origin GETs. It does not yet cover cancellation, boundaries,
long media, mobile devices, CSP, or LGPL compliance. Do not reclassify those
as PASS until separately tested.

## Release gates

- Confirm the encoder's runtime worker uses the same WASM as the upstream
  `build/lame.js`; the helper inspects the Emscripten module's exact binary.
- Independently assess LGPL/MPL notices and corresponding source plus the
  ability to rebuild/replace the embedded library.
- Verify worker isolation, abort/timeout, cleanup, CSP, all edge cases and
  memory; remove the FFmpeg dependency only after the replacement passes.
- Keep the product PR draft and blocked from publication. The existing
  starter CI uploads its legacy FFmpeg build; this new pinned candidate must
  **not** be included in its upload artifacts.

This is technical preparation and reproduction guidance, not a claim that the
pinned-source browser run or legal audit has passed.
