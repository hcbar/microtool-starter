# Audio to MP3 — product #1 / Issue #10

- **Task/value:** extract MP4 audio or convert OGG/Opus recordings to a real
  downloadable 128 kb/s MP3, on the user's device, without login or uploading.
- **Languages:** English, Brazilian Portuguese, Spanish. No domain selected:
  `siteUrl=""`, `indexable=false`; all review builds noindex.
- **Outcome:** one local file → validated audio-only MP3 → optional local
  playback → explicit save. Input and output sizes and current stage are visible.
- **Scope:** MP4/M4A with AAC, OGG/Opus with Opus, OGG with Vorbis. Extension is
  an admission filter; header/container/codec probing determines actual content.
  Other codecs, encrypted media and unusual/malformed containers can be rejected.
  No batch, trimming, recording, remote links, backend conversion or infrastructure.
- **Limits:** 25 MiB on touch/mobile, 50 MiB desktop, <=6 minutes, one job at a
  time. 120-second wall timeout; cancellation terminates a disposable WASM worker.
  Fixed 44.1kHz stereo 128kb/s MP3, first audio track, no video/subtitles or copied
  metadata. Encoder padding can add a small duration difference. No silent truncation.
- **Privacy/cost:** local profile, static resources only. No backend media API,
  ads, analytics, premium, accounts, cookies or paid APIs. Processing server cost
  is zero; ordinary static hosting bandwidth, especially codec delivery, remains.
- **Codec:** @ffmpeg/ffmpeg 0.12.15, @ffmpeg/core 0.12.10 single thread, pinned
  lockfile. Core is lazy and self-hosted; no CDN scripts, SharedArrayBuffer or
  COOP/COEP. Initial EN HTML+JS+CSS+messages: about 16.5 kB uncompressed.
  WASM 32,232,419 bytes + glue 111,804 bytes (~30.85 MiB); gzip-equivalent WASM
  is about 10.23 MB, but transfer encoding depends on the future host. No host is
  activated. Build manifest hashes the actual distributed resources.
- **License gate:** wrapper/types MIT; stock core **GPL-2.0-or-later**, including
  external GPL codecs. Commercial use is conditional on compliance, not MIT
  redistribution. Full corresponding source, exact external-library revisions,
  complete notices and application distribution terms remain publication blockers.
  See `docs/codec-licenses.md`; this candidate is not cleared for release.

## Actual validation (2026-10-26, Linux x64 Codespace)

- Initial technical gate: small synthetic MP4/AAC, OGG/Opus, Opus, M4A/AAC and
  OGG/Vorbis converted by the actual core; outputs decoded by Chromium AudioContext
  at ~2 seconds. Initial warm-core conversion times 39–206 ms in the first gate;
  these are not complete page/download latencies or physical-phone benchmarks.
- `npm run verify`: **38 Node tests passed**, plus configuration, prerendered
  build and security/noindex checks. Tests retain the starter's backend isolation,
  publisher preflight, orchestration and disabled DRY_RUN controls.
- Chromium **143.0.7499.4** HTTP integration: five 2-second formats on desktop
  and 390×844 touch/mobile viewport; real downloaded bytes decoded as MP3,
  duration within 0.15s and MIME audio/mpeg. MP4 includes a video track.
  Additionally: renamed OGG content in an MP4 filename; malformed bytes and
  truncated container; no-audio MP4; unsupported extension; byte limits; multiple
  files; real worker cancellation; replacement during conversion; codec network
  failure/recovery; URL/worker cleanup; three locales, keyboard and no overflow.
- Boundary cases: synthetic 359.9s AAC converted and MP3 decoded; 361s rejected
  before conversion. One full integration run measured 9.1s desktop / 12.4s
  mobile emulation for conversion + playback decode + overlong-file rejection.
  Short complete flows were ~1.4–2.1s. Mobile CDP CPU throttling rate 4 is set;
  this does not reproduce physical device RAM, thermals or every worker's speed.
- That run's full Chromium process-tree peak aggregate RSS: **850.2 MiB**,
  aggregate CPU **89.44 seconds** across the suite, including synthetic fixture
  generation and playback decoding. RSS samples include shared pages in multiple
  processes; they are not unique memory or isolated codec allocations. Subsequent
  per-phase measurements include ~744 MiB desktop / ~739 MiB mobile at the
  duration boundary (including fixture generation), CPU 19.91s / 35.66s. Full
  measurements and logs/screenshots live in the CI artifact
  under `test-results/browser-evidence.json`. No simulated instability was observed;
  limits remain at their initial values and are never automatically increased.
- Network assertions allow only same-origin static GETs and local blob media,
  with no request bodies. Core is not requested before conversion. No user file
  is sent to a conversion service. These tests do not prove arbitrary supply-chain
  compromise impossible.

## Residual risks and acceptance gates

WASM SIMD/browser support, decoder allocation spikes, CPU and memory vary. The
stock core is large and includes unused codecs; a reduced, fully pinned audio-only
core could improve size and provenance in an explicitly scoped follow-up. Byte and
duration limits cannot guarantee low RAM on all media. Safari and physical phones
are **untested**. Browser emulation and implementer self-checks are not independent
security review. No search-demand, organic acquisition or revenue metrics invented;
those are unknown before an authorized launch. Test conversions are the current
success metric, not real-user conversion rates.

User authorized branch, implementation, local tests, commit, push and review PR
only. Base `e5e88173b84804cca4d749f79b99065c37b2020c`; record final head/merge and
CI URLs in the PR. Independent Astra review is pending for codec/licenses/local
isolation/build. Do **not merge this product PR into starter main**. Resolve
license/source blockers, obtain acceptance, then separately authorize transfer of
the reviewed commit to a product repository and rerun CI there. Merge/deploy,
publication, credentials, repository protections and any Recorte access are not
authorized. No production activation in this ticket.
