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

The smoke retains all seven MP3/decode/RMS regressions. In candidate mode,
`lifecycle-probe.mjs` delegates to native Workers and AudioDecoders and the real
pinned modules. It records successful `encode` responses containing MP3 bytes;
it does not generate replies or replace the encoder. It checks worker termination,
input disposal and decoder closure **when the adapter promise settles**, with no
polling grace period. Each of the seven successful conversions must create one
worker and return encoded bytes. Additional cases cover:

- Abort in `onStage('converting')`: before `execute()`, so zero workers and zero
  encode replies are expected. This was the incorrect nonzero-worker assertion
  behind CI run 41089687309 on head `c062e33908a193502607e7ffcaf763fd48717566`.
- Abort on the first native encode reply with nonempty MP3 bytes from a synthetic
  30-second AAC input: one worker, an `AbortError`, no result and no flush command.
  This is processing already underway, interrupted before completion.
- A deliberately throwing BufferTarget `onwrite` callback: real encoding, followed
  by output failure and the same resource cleanup assertions. This is fault
  injection at the output boundary, not a mocked conversion/worker.
- Invalid extension, empty input and a real no-audio MP4 rejection.

The adapter checks the signal again after the stage callback and joins both the
losing conversion task and asynchronous cancellation before disposing inputs.
It also cancels on ordinary errors, handles a conversion assigned after abort
while `init()` was pending, and waits for Output's resource-release promise when
upstream cancellation has already begun. Unit tests separately cover delayed
cleanup, late initialization, execute failure and timeout contracts.

The harness rejects browser page/console errors and outbound/non-GET traffic.
Set `CHROMIUM_PATH` only to use an installed browser locally; CI continues using
the locked Playwright Chromium. Local Chromium 154.0.8037.57 passed the seven
conversions and lifecycle cases; this is a different browser from CI's 143 build.
No physical mobile/Safari, production CSP, memory bound or legal compliance is
established. In particular the upstream inline-worker helper creates a blob URL
without explicit revocation; worker termination is measured here, while blob URL
ownership/revocation must be addressed with the production packaging decision.

## Release gates

- Confirm the encoder's runtime worker uses the same WASM as the upstream
  `build/lame.js`; the helper inspects the Emscripten module's exact binary.
- Independently assess LGPL/MPL notices and corresponding source plus the
  ability to rebuild/replace the embedded library.
- Verify production worker/blob-URL ownership, hard-stop behavior if a codec
  hangs (cooperative cancellation can wait on upstream work), CSP, remaining edge
  cases and memory; remove the FFmpeg dependency only after the replacement passes.
- Keep the product PR draft and blocked from publication. The existing
  starter CI uploads its legacy FFmpeg build; this new pinned candidate must
  **not** be included in its upload artifacts.

This is technical preparation and reproduction guidance, not a claim that the
production adoption or legal audit has passed.
