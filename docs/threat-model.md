# Audio to MP3 — local processing threat model

- **Assets:** local media contents, filenames, browser memory/CPU, integrity of
  the shipped codec and the starter's release controls.
- **Boundary:** browser loads same-origin static JS/WASM on demand. There is no
  media API, upload, backend conversion, service worker, account or telemetry.
  The unchanged backend example is inactive in the `local` product profile.
- **Untrusted input:** file extension/MIME, container metadata, codec bitstreams,
  declared duration and filenames. A supported extension is only a UI allowlist;
  bounded header inspection and FFprobe validate actual content before encoding.
- **Resource controls:** 25 MiB touch/mobile or 50 MiB desktop before full read,
  one UI job at a time, finite positive duration <=360 seconds before decoding,
  first audio stream only, fixed stereo 44.1kHz 128kb/s MP3. Output decode is
  capped at 361 seconds and 6 MiB; overlong/mismatched durations are rejected,
  not delivered as silent truncation. A 120-second wall timeout terminates the
  disposable worker, including stalled loading/probing/encoding.
- **Isolation/cleanup:** FFmpeg protocols limited to file/pipe and demuxers to
  mov/ogg; inputs have fixed in-memory paths. User filenames never become codec
  options, filesystem paths, markup or outbound URLs. All worker files and WASM
  memory are discarded by worker termination on every outcome. FileReader abort,
  generation invalidation and URL revocation prevent obsolete outputs; output
  preview is cleared before revocation, and pagehide cancels active work.
- **CSP:** same-origin JS and workers, WASM compilation only; no inline scripts,
  general eval, external connections or executable CDN. Blob playback is allowed
  via media-src. No microphone/camera/geolocation/payment permissions.
- **Supply chain:** npm exact direct versions and lockfile integrity; no runtime
  package installation. GPL core includes unused video codecs, increasing size
  and attack surface. Source correspondence and notices remain a release blocker;
  see `codec-licenses.md`. npm audit is evidence, not proof of absence of flaws.
- **Residual risks:** malicious bitstreams may exploit upstream WASM/browser
  bugs or cause transient memory pressure before the watchdog fires. Input byte
  and duration limits do not cap every decoder allocation. WASM SIMD support and
  available RAM vary. Mobile viewport/touch/CPU emulation is not physical hardware.
  Worker termination releases references; OS reclamation/GC timing is variable.
- **Owner gates:** independent Astra review of exact base/diff/SHA, license/source
  closure, product repository separation and separately authorized publication.
  No merge into starter main. No deployment, credentials or infrastructure work.
