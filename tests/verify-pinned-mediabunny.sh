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
python3 "$ROOT/experiments/mediabunny/check-pinned-wasm.py" "$TEMP/upstream/packages/mp3-encoder/build/lame.js"
(
  cd "$TEMP/upstream"
  npm ci --ignore-scripts --no-audit --no-fund
  npm run build
)
mkdir -p "$STAGED"
cp "$TEMP/upstream/dist/bundles/mediabunny.min.mjs" "$STAGED/"
cp "$TEMP/upstream/packages/mp3-encoder/dist/bundles/mediabunny-mp3-encoder.mjs" "$STAGED/"
# Fixed-source JS bundle should embed the exact WASM advertised by upstream.
python3 - "$STAGED/mediabunny-mp3-encoder.mjs" <<'PY'
import base64,hashlib,re,sys
from pathlib import Path
data=Path(sys.argv[1]).read_bytes()
m=re.search(rb'base64Decode\("(AGFzbQ[^"]+)"\)',data)
if m is None: raise SystemExit("BLOCK: no embedded WASM found in runtime bundle")
got=hashlib.sha256(base64.b64decode(m[1],validate=True)).hexdigest()
expected="a680e507e9d91f1a4dcd6f846b9b94ff1fec7e19ff44e803358c218ddbe446a6"
if got!=expected: raise SystemExit(f"BLOCK: runtime WASM mismatch: {got}")
print("PASS: runtime bundle contains documented SHA256",got)
PY
# Build produces only the legacy fixture generator; do not upload new WASM.
cd "$ROOT"
MEDIABUNNY_CORE_MODULE=/experiments/mediabunny/pinned-build/mediabunny.min.mjs \
MEDIABUNNY_ENCODER_MODULE=/experiments/mediabunny/pinned-build/mediabunny-mp3-encoder.mjs \
MEDIABUNNY_CANDIDATE_ADAPTER=1 \
python3.12 experiments/mediabunny/smoke.py
