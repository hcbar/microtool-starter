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

## P1 follow-up — bounded provenance investigation (2026-10-26)

**Conclusion: the exact corresponding source is not demonstrated by the public
records inspected. Publication remains BLOCKED.** This does not establish that
upstream cannot supply it; it establishes that the available evidence below is
insufficient. No core rebuild, dependency change or upstream contact was made.

Rechecked the installed ESM WASM with `sha256sum`: it is still
`9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7`.
`npm view @ffmpeg/core@0.12.10 gitHead dist --json` returns no `gitHead`, no
`dist.attestations`, five package files, and integrity
`sha512-dzNplnn2Nxle2c2i2rrDhqcB19q9cglCkWnoMTDN9Q9l3PvdjZWd1HfSPjCNWc/p8Q3CT+Es9fWOR0UhAeYQZA==`
(the lockfile value). A registry signature authenticates a package record; it
does not identify all sources used to build its embedded binary.

The useful new lead is the actual
[core release commit 71aa99d](https://github.com/ffmpegwasm/ffmpeg.wasm/commit/71aa99d37c02a7b4c435275ca9ef50e612f6efa1),
dated 2025-01-07, whose
[package metadata](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/71aa99d37c02a7b4c435275ca9ef50e612f6efa1/packages/core/package.json)
declares 0.12.10. This is a source candidate, **not proof that it produced the
installed hash**. Its
[Dockerfile](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/71aa99d37c02a7b4c435275ca9ef50e612f6efa1/Dockerfile)
uses Emscripten 3.1.40 without an image digest, FFmpeg n5.1.4, mutable LAME
`master` and x264 `4-cores`, plus other dependency tags. It copies local
`src/fftools`, bindings and build scripts, and links the GPL video libraries.
Resolving those branches today cannot establish their build-time commits.

The
[workflow at that commit](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/71aa99d37c02a7b4c435275ca9ef50e612f6efa1/.github/workflows/CI.yml)
uploads compiled `packages/core/dist/*`, not a complete source/dependency manifest
or a binary-to-source attestation. The Actions API query for that exact head
returned no runs; absence now does not prove no historic build existed. The
[release inventory](https://github.com/ffmpegwasm/ffmpeg.wasm/releases) has no
complete corresponding-source asset identified for this core. The nearby
[v12.14 release](https://github.com/ffmpegwasm/ffmpeg.wasm/releases/tag/v12.14)
has `packages.zip`, but its
[source package](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/d3c018aa40a241384965268f0506b73f47dee60c/packages/core/package.json)
declares core 0.12.9. Neither it nor wrapper tag v0.12.10 proves correspondence
for core 0.12.10. No third-party mirror was accepted as evidence.

To close this for the existing hash, obtain from the builder a source archive
and immutable manifest for FFmpeg, every linked library and submodule, patches,
bindings, scripts/configuration, toolchain identification and notices, with
build records linking them to the hash above. Then independently check the
manifest, licensing and binary/build correspondence. Merely reproducing a
version string is insufficient; byte-identical reproduction would be strong
additional evidence but is not asserted here.

Distribution would need an accessible, versioned corresponding-source archive
alongside the binary plus applicable notices/license texts and reviewed application
terms. The current notice and GPL text alone do not close that gate. See the
[FFmpeg licensing guidance](https://www.ffmpeg.org/legal.html) and the linked GPL
text above; LGPL checklist steps must not be mistaken for clearance of this GPL
build. No source delivery has been activated.

If the builder cannot supply the missing record, the owner's next decision is:

| Alternative (not implemented) | Benefit | Remaining cost / uncertainty |
|---|---|---|
| Fully pinned audio-only FFmpeg core | Preserve the current decoding/encoding path while controlling source inventory and excluding unused GPL video codecs | Estimated several engineering days for build, notices, license review and five-format/browser/boundary validation; LGPL obligations still need review; size/speed gains must be measured |
| Smaller alternative pipeline, e.g. browser decoding plus a separately licensed MP3 encoder | Potentially less WASM and a simpler dependency inventory | Estimated several days of feasibility work before migration sizing; AAC/Opus/Vorbis/container support varies by browser, and encoder licensing/source obligations and output parity must be verified |

These are planning estimates, not measured implementation costs or recommended
libraries. Both require fresh authorization; neither was started.

## Authorized replacement spike — 2026-10-26

The owner subsequently authorized a bounded Mediabunny/LAME prototype in
[PR #11](https://github.com/hcbar/microtool-starter/pull/11#issuecomment-6409801470).
Its [report, reproduction and source inventory](../experiments/mediabunny/README.md)
and [measured evidence](../experiments/mediabunny/evidence.json) record seven real
Chromium conversions passing with pinned packages. The embedded LAME binary
matches an immutable upstream precompiled artifact, but its full corresponding
source/build and LGPL replacement-delivery path remain unverified:
**FUNCTIONAL_PASS / LICENSE_BLOCK**. The stopping criterion applies; no product
codec migration, manual rebuild or publication was performed. The FFmpeg gates
above remain in effect. Independent focal review of the spike remains pending.
