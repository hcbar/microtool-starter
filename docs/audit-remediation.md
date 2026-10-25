# Independent audit response — starter 0.2.2 candidate

Baseline: `hcbar/microtool-starter@3874749d00257a587f15535e08381ada1660ac70` (Astra audit, 2026-10-25). This is a proposed change **not yet merged, independently reaudited, deployed or approved**.

## Changes in this candidate

- **F1:** removed the unchecked shortcut for small `image/jpeg` blobs. Input headers are checked, then the actual browser decoder validates content and dimensions. Source JPEGs are re-encoded instead of silently returned, so source EXIF is not passed through unchanged.
- **F6 (partial mitigation):** bounded scan of at most 256 KiB for known JPEG/PNG/WebP headers, rejecting known dimensions above 24 MP before native decode; another size cap remains after decode. Unknown JPEG/WebP layouts may still require native decode, and native operations cannot be forcibly cancelled.
- **F2:** separate preview and production-indexable fixture builds in a temporary project directory, preventing `npm run verify` from accidentally calling preview guards against production files.
- **F7:** added Node regressions for fake/truncated JPEG, headers claiming enormous images, oversized byte input, invalid MIME, PNG and cancellation; real-browser smoke now covers both a valid small JPEG and a fake one.

## Evidence and limits

Locally executed: `npm run verify` with 16/16 Node tests; `CHROMIUM_PATH=/usr/bin/chromium python tests/browser-offline-smoke.py` exercised real JPEG generation, fake-JPEG rejection and cancellation; `python -m py_compile` verified the HTTP smoke script syntax. **The full HTTP browser smoke was not run locally** because this sandbox blocks Chromium navigation to localhost (`ERR_BLOCKED_BY_ADMINISTRATOR`). GitHub Actions is expected to run the full HTTP smoke for the candidate after a PR; do not claim it passed before seeing its logs.

## Still blocking publication

- **F3:** `main` is not protected by required PR/check gate, as confirmed during the audit. Configure branch/ruleset protections as available and verify their effective enforcement before trusting automated releases.
- **F4:** no approved preview/production publisher. Do not modify the preflight workflow into a credential-bearing deployment without an independent audit. Build SHA + complete Worker/config/assets hashes, destination/account allowlist, locked dependencies, separate preview/prod credentials, remote smoke and rollback verification are required.
- **F5:** Python Playwright version is pinned but all transitive wheels and hashes are not pinned. Lock before using artifacts as publish inputs.
- **F6/F7 residual:** test physical mobile/Safari and memory-heavy inputs before advertising device guarantees; verify ObjectURL release and unusual image parsing paths.
- **Reusability:** `new:product` still edits metadata, not product logic. A distinct second utility is needed to prove the process.

Next gate: submit the exact patch to Codex/CI, then request a focused independent Astra review of F1/F2/F6/F7 against the fixed SHA. Leave `hcbar/recorte` unmodified.
