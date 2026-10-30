# Audio to MP3 — Issue #10 review candidate

Local MP4/M4A (AAC), OGG (Opus/Vorbis) and Opus → real 128 kb/s MP3.
One file, browser conversion, local preview and download. English, pt-BR, Spanish.
No uploads, accounts, backend media processing, ads, analytics or paid APIs.

**Product branch `codex/product-1-audio-to-mp3`: do not merge into starter main.**
The review PR is for candidate code, CI and audit only. Main remains the reusable
starter. No deployment or new product repository is authorized by this task.

```sh
npm ci --ignore-scripts
npm run verify
npm run dev
```

Node >=22.13. Open http://127.0.0.1:4173 (`/pt/`, `/es/`). Windows: use `npm.cmd`.
Limits: 25 MiB touch/mobile, 50 MiB desktop, up to 6 minutes; 120-second watchdog.
Codec is single-thread WASM, self-hosted, pinned and lazy (~31 MiB uncompressed).
Chromium is tested; Safari and physical phones are not certified.

Browser suite (same locked harness as CI, Python 3.12 Linux x64):

```sh
python3.12 -m venv /tmp/audio-browser
/tmp/audio-browser/bin/pip install --only-binary=:all: --require-hashes -r tests/requirements-browser.txt
/tmp/audio-browser/bin/python -m playwright install --with-deps chromium
/tmp/audio-browser/bin/python tests/browser-smoke.py
```

The suite starts/stops its own server; stop `npm run dev` first. It checks real
MP3 downloads and browser decode, desktop/mobile, languages, keyboard, noindex,
no external transfer, duration/size limits, malformed/no-audio/unsupported input,
cancel/replacement, worker/URL cleanup and codec failure/recovery. Measurements
and screenshots go to `test-results/`; CI includes them with the tested artifact.
Fixtures are synthetic and committed; regeneration is in `tests/fixtures/README.md`.

**License/publication BLOCK:** wrapper MIT; stock core GPL-2.0-or-later with
external copyleft libraries. Exact source correspondence, all linked-library
notices and commercial distribution terms need independent review and closure
before publishing any binary. See [codec decision](docs/codec-licenses.md),
[product evidence](PRODUCT.md), [threat model](docs/threat-model.md).
A green test is not distribution clearance or independent Astra review.

After acceptance and separate authorization: transfer this branch's exact
reviewed commit to a separate product repository, preserve notices/source/test
provenance, rerun CI there, then request an independently reviewed release.
Do not merge this product into the reusable template or activate hosting here.
The starter's no-deploy preview controls and disabled DRY_RUN bridge remain.
