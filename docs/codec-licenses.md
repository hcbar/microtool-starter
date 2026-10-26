# Codec decision and distribution gate — Issue #10

## Exact packages and observed binary

- `@ffmpeg/ffmpeg` **0.12.15**: MIT wrapper. Its transitive `@ffmpeg/types`
  **0.12.4** is MIT, resolved by the committed lockfile; type declarations are
  not shipped to the browser. Exact top-level versions, registry integrity and
  all transitive resolutions are in `package-lock.json`.
- `@ffmpeg/core` **0.12.10**: package metadata says **GPL-2.0-or-later**.
  It is not covered by the wrapper's MIT license. No multithread core is used.
- Executing `-version` on the installed WASM reports FFmpeg **5.1.4**,
  Emscripten **3.1.40**, `--disable-pthreads`, `--enable-gpl`, libmp3lame,
  libopus, libvorbis, libx264, libx265 and other external libraries.
- The MP3 encoder is verified by execution, not inferred from package metadata.
  The initial smoke decodes MP4/AAC, OGG/Opus, Opus, M4A/AAC and OGG/Vorbis
  outputs with Chromium's AudioContext. Core ffprobe reports `-1` with valid
  JSON in this version: the app requires parsed, bounded media metadata and
  validates output metadata, instead of relying on that return value.

SHA256 of the exact shipped single-thread ESM assets:

| Asset | Bytes | SHA256 |
|---|---:|---|
| ffmpeg-core.wasm | 32,232,419 | `9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7` |
| ffmpeg-core.js | 111,804 | `67a48f11645f85439f3fde4f2119042c16b374b910206b7a7a24f342e28dcae3` |

`npm ci --ignore-scripts` supplies these files; build copies them unmodified to
`dist/assets/core/`. The wrapper module worker is copied to `assets/ffmpeg/`.
Every load supplies explicit same-origin URLs. No runtime CDN fallback is used.
The CSP retains `connect-src 'self'`, adds `wasm-unsafe-eval`, same-origin workers
and blob media only; it does not enable arbitrary JavaScript eval or inline code.
No SharedArrayBuffer, COOP or COEP is needed.

## Commercial viability and unresolved distribution evidence

GPL permits commercial use with its conditions. This stock core includes GPL
video libraries even when the app only uses audio codecs. LAME is LGPL;
Opus/Ogg/Vorbis have BSD-style licenses. Those descriptions do **not** replace
checking every linked library's actual source and notices. Patent/trademark
questions and the appropriate license for the combined application require
owner/legal review before a commercial launch.

The repository serves the wrapper MIT text, GPL v2 text and an explicit notice.
**Publication is BLOCKED** until independent review verifies all of:

1. Complete corresponding source for this precise WASM: FFmpeg, all linked
   external libraries, local patches, build scripts and required configuration.
2. Immutable revisions and license notices for each dependency, and an accessible
   source archive distributed alongside the binary (or another compliant method
   reviewed for the applicable GPL version). A link to a changing branch is not
   proof of corresponding source.
3. Copyleft implications for the application and its distribution terms. No
   assertion is made that this whole product is MIT or cleared for proprietary use.

Upstream source inspection found `v0.12.10` is a **wrapper release**, whose
`packages/core/package.json` still says 0.12.6; it must not be labeled the source
of core 0.12.10. Upstream main commit
`f876f907c7e9b9bf51d4ed0b913a855a63ae63fc` does declare core 0.12.10.
Its build lineage uses FFmpeg n5.1.4 and external forks; some dependency selectors
are mutable (for example LAME `master`). Package provenance does not establish
all original external commit hashes. This PR is a review candidate, not completed
commercial distribution clearance. A proportional resolution is to obtain the
precise upstream source bundle/revisions, or rebuild a reduced audio-only core
from fully pinned sources in a separately approved follow-up. Do not publish
this artifact assuming a version tag or npm license field satisfies the gate.

Primary references checked 2026-10-26:

- [ffmpeg.wasm licensing FAQ](https://ffmpegwasm.netlify.app/docs/faq/#what-is-the-license-of-ffmpegwasm)
- [FFmpeg legal and source obligations](https://www.ffmpeg.org/legal.html)
- [Upstream source/build recipe](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/f876f907c7e9b9bf51d4ed0b913a855a63ae63fc)
- [GPL v2](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html)
