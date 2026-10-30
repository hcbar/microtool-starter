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
node experiments/mediabunny/build-isolated.mjs /tmp/mediabunny-fixed experiments/mediabunny/pinned-build
MEDIABUNNY_CORE_MODULE=/experiments/mediabunny/pinned-build/mediabunny.min.mjs \
MEDIABUNNY_ENCODER_MODULE=/experiments/mediabunny/pinned-build/mediabunny-mp3-encoder.mjs \
MEDIABUNNY_CANDIDATE_ADAPTER=1 python3.12 experiments/mediabunny/smoke.py
python3.12 experiments/mediabunny/isolation-smoke.py
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

## Isolated candidate: bounded forced termination and CSP

This round adds an experimental wrapper, not a migration into `src/`.
`isolated.mjs` owns a disposable conversion worker and a native encoder worker
**in the page**. A small `MessageChannel` bridge implements just the pinned
encoder's worker contract; audio buffers are transferred through the page, not
uploaded. The conversion worker runs the existing adapter, probing, decoding
and MP3 verification. No media work runs on the page's event loop.

### Existing upstream solutions considered before implementation

At the fixed SHA, `Conversion.cancel()` awaits `Output.cancel()`, whose source
closure is serialized behind pending custom-encoder work. `pauseSignal` also
requires progress/checkpoints. Neither can interrupt a hung operation. The MP3
encoder's `close()` terminates its private worker, but is reached through that
serialized work and does not cover a decoder or conversion-thread hang. There
is no public worker factory/URL injection option in this revision.

The upstream build helper creates a blob URL and returns a Worker without a
revocation step. Merely counting termination does not release that URL. Global
patching in the application and copying/reimplementing the LAME encoder were
rejected. The isolated package changes only the build-time `createWorker`
import: the encoder handler and LAME bytes are compiled from their unmodified
pinned sources into an ephemeral **static** worker script. No blob URLs are
created by the isolated pipeline, so there are no worker URL leases to revoke.
The original cooperative spike remains historical and still uses upstream's
blob helper; it is not the new isolated candidate.

A conversion worker with a nested LAME worker would use fewer bridge lines,
but a controlled double busy-loop showed serial native shutdown of about 4 s
in local Chromium. Page-owned workers terminate independently in parallel,
about 2 s in the same test. This is why the small bridge is retained. It adds
no extra thread, pool, persistent registry or retry mechanism.

### Deadline semantics and actual shutdown evidence

The page starts the timer before posting the file. `timeoutMs` is the **total**
deadline (default 120,000 ms, must exceed 3,000 ms). It reserves the final
3,000 ms for native shutdown and requests termination of BOTH independent
worker handles at `timeoutMs - 3000`. Abort and fatal worker errors also
terminate both immediately and settle after that bounded shutdown allowance.
Normal completion and errors already cleaned up by the adapter do not incur
that delay. Every path closes the page's bridge port and removes the abort
listener; terminated realms reclaim the transferred ports and decoder state.
No acknowledgment from a hung codec/decoder or `conversion.cancel()` is needed.

This allowance is explicit: Chromium was observed taking about 2 s to forcibly
interrupt a busy loop after `Worker.terminate()`. It is not an assertion that
`terminate()` synchronously destroys a native worker, nor a universal real-time
browser guarantee. The test requires **no native worker targets at forced-stop
promise settlement**, and matches every creation with the browser's actual
`Target.targetDestroyed` event. The test fails if the shutdown budget is
insufficient; it does not merely count calls or wait indefinitely. A small
500 ms inspector-event drain is allowed only for normal completion.

### Browser validation

`isolation-smoke.py` uses the application's exact CSP string from `dist/_headers`
for the document AND worker responses:

- `script-src 'self' 'wasm-unsafe-eval'`, `worker-src 'self'`, `connect-src 'self'`;
  no worker `blob:`, remote scripts, `unsafe-inline` or general `unsafe-eval`.
- All seven existing MP3 cases run through the isolated path and are decoded
  with duration/RMS checks. Normal decoding explicitly closes its AudioDecoder.
- Real cancellation on nonempty native LAME output; no-audio failure; an actual
  encoder-worker exception after one real response; forced timeouts with a busy
  decoder, busy encoder, and both conversion/encoder workers busy; explicit
  cancellation after both busy-loop markers have been observed.
- Native worker creation/destruction events and page-owned constructors are
  observed independently. URL creation/revocation is instrumented in every
  worker realm and the page. The isolated cases must create ZERO blob URLs.
- The actual bytes supplied to `WebAssembly.instantiate` in the encoder worker
  are hashed while still delegating to real instantiation. The seven successes
  and all cases reaching encoding must match the fixed WASM hash above.
- Negative controls remove only `wasm-unsafe-eval` from the encoder response,
  attempt a blob worker, inline script and general JS eval. Browser CSP
  violations/rejections must occur. The deliberately created negative-control
  URL is explicitly revoked. These expected violations are recorded separately
  from positive cases, which permit no CSP, page or console errors.

The loopback server injects `isolation-fixtures.js` only during testing. Its
faults use real infinite loops and an uncaught exception after real encoding;
no fake completion, encoder reply or cooperative-cancellation acknowledgment
is generated. Production candidate modules never import the fault harness.
The fixed-source CI script builds everything in its disposable directory,
runs both browser suites, and removes generated files without uploading them.

## Remaining promotion/distribution gates

- Repeat these assertions for the eventual delivery/package and HTTP headers;
  the immutable source and runtime WASM identity measured here are specific to
  this isolated packaging, not a clearance for a later npm version.
- Independently assess LGPL/MPL notices, corresponding source, modified packaging
  recipe and practical rebuild/replacement delivery. No legal clearance claimed.
- Memory/CPU budgets, representative edge cases, file replacement, physical
  phones and Safari remain unproven. Foreground Chromium timers are tested;
  OS suspension, a frozen main page/browser process and other browsers are not
  covered by a real-time guarantee. Browser-native teardown/decoder allocation
  behavior remains a browser dependency, not a JavaScript safety proof.
- Keep the PR draft and publication blocked. No app migration, deploy or new
  product is performed. The traditional CI artifact remains its legacy FFmpeg
  build; isolated modules/bundles/WASM must never enter that upload.

This is technical preparation and reproduction guidance, not a claim that
production adoption or legal audit has passed.
