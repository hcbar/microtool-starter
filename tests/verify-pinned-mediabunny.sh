#!/usr/bin/env bash
# CI-only evaluation: source revision fixed, all binaries ephemeral, no artifacts.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMP="$(mktemp -d)"
STAGED="$ROOT/experiments/mediabunny/pinned-build"
cleanup() { rm -rf "$STAGED" "$TEMP"; }
trap cleanup EXIT
COMMIT="cce92cb0f131f522295dc0797962fb1f5d3c1f44"
mkdir -p "$TEMP/upstream"
git -C "$TEMP/upstream" init -q
git -C "$TEMP/upstream" remote add origin https://github.com/Vanilagy/mediabunny.git
git -C "$TEMP/upstream" fetch -q --depth=1 origin "$COMMIT"
git -C "$TEMP/upstream" checkout -q --detach FETCH_HEAD
test "$(git -C "$TEMP/upstream" rev-parse HEAD)" = "$COMMIT"
node "$ROOT/experiments/mediabunny/check-pinned-wasm.mjs" "$TEMP/upstream/packages/mp3-encoder/build/lame.js"
(
  cd "$TEMP/upstream"
  npm ci --ignore-scripts --no-audit --no-fund
  npm run build
)
mkdir -p "$STAGED"
cp "$TEMP/upstream/dist/bundles/mediabunny.min.mjs" "$STAGED/"
cp "$TEMP/upstream/packages/mp3-encoder/dist/bundles/mediabunny-mp3-encoder.mjs" "$STAGED/"
# Bundles were rebuilt from exactly the checked-out upstream revision.
# Confirming runtime worker/bundle correspondence remains a release gate.
# Build produces only the legacy fixture generator; do not upload new WASM.
cd "$ROOT"
MEDIABUNNY_CORE_MODULE=/experiments/mediabunny/pinned-build/mediabunny.min.mjs \
MEDIABUNNY_ENCODER_MODULE=/experiments/mediabunny/pinned-build/mediabunny-mp3-encoder.mjs \
MEDIABUNNY_CANDIDATE_ADAPTER=1 \
python3.12 experiments/mediabunny/smoke.py
