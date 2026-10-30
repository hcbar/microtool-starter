// Source-only candidate for Issue #12. NOT imported by the production build.
// No encoder bundle, source archive, or WASM is committed by this file.
// Production migration still requires a provenance-checked package release,
// CSP/worker isolation, real browser tests, and independent LGPL review.
export const MAX_SECONDS = 360;
export const MAX_MP3_BYTES = 6 * 1024 ** 2;

export function validateCandidateFile(file, mobile = false) {
  if (!file || !/\.(mp4|m4a|ogg|opus)$/i.test(file.name || '')) throw Error('format');
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > (mobile ? 25 : 50) * 1024 ** 2) throw Error('size');
}

export function selectedAudioWindow(firstTimestamp, lastTimestamp) {
  // Treat timestamp offsets as offsets, not as audio duration. MP4 video and
  // audio end times can differ; never trust the container's video duration.
  const first = Number(firstTimestamp);
  const last = Number(lastTimestamp);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first < 0 || last <= first) throw Error('duration');
  const start = Math.max(0, first);
  const duration = last - start;
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_SECONDS) throw Error('duration');
  return {start, end: last, duration};
}

// The library and registration function are injected so unit tests can run
// WITHOUT downloading or redistributing the unverified legacy WASM binary.
// The same API was exercised by the separate 7/7 real-Chromium spike.
export async function convertCandidate(file, {
  mediabunny: m, registerMp3Encoder, signal, mobile = false,
  onStage = () => {}, timeoutMs = 120000,
} = {}) {
  validateCandidateFile(file, mobile);
  signal?.throwIfAborted();
  if (!m || typeof registerMp3Encoder !== 'function') throw Error('codec');
  let input, verify, conversion, timeout, rejectStopped, stoppedError;
  const stopped = new Promise((_, reject) => { rejectStopped = reject; });
  // A rejected stop promise remains observed if work finishes first.
  stopped.catch(() => {});
  const interrupt = error => {
    if (stoppedError) return;
    stoppedError = error;
    if (conversion) void Promise.resolve().then(() => conversion.cancel()).catch(() => {});
    rejectStopped(error);
  };
  const onAbort = () => interrupt(new DOMException('Cancelled', 'AbortError'));
  signal?.addEventListener('abort', onAbort, {once: true});
  timeout = setTimeout(() => interrupt(Error('timeout')), timeoutMs);
  const check = () => {if (stoppedError) throw stoppedError; signal?.throwIfAborted();};
  try {
    return await Promise.race([stopped, (async () => {
      onStage('checking');
      input = new m.Input({source: new m.BlobSource(file), formats: m.ALL_FORMATS});
      const track = await input.getPrimaryAudioTrack(); check();
      if (!track) throw Error('audio');
      if (!['aac', 'opus', 'vorbis'].includes(await track.getCodec())) throw Error('format');
      if (!await track.canDecode()) throw Error('codec');
      const {start, end, duration} = selectedAudioWindow(
        await track.getFirstTimestamp(), await track.computeDuration()
      );
      check();
      registerMp3Encoder();
      const target = new m.BufferTarget();
      const output = new m.Output({format: new m.Mp3OutputFormat(), target});
      conversion = await m.Conversion.init({
        input, output, tracks: 'primary', video: {discard: true},
        audio: {codec: 'mp3', bitrate: 128000, sampleRate: 44100, numberOfChannels: 2},
        trim: {start, end}, tags: {},
      });
      check();
      if (!conversion.isValid) throw Error('format');
      onStage('converting');
      await conversion.execute(); check();
      const data = target.buffer;
      if (!(data instanceof ArrayBuffer) || data.byteLength < 100 ||
          data.byteLength > MAX_MP3_BYTES) throw Error('invalid');
      const blob = new Blob([data], {type: 'audio/mpeg'});
      verify = new m.Input({source: new m.BlobSource(blob), formats: [m.MP3]});
      const tracks = await verify.getTracks();
      const mp3 = await verify.getPrimaryAudioTrack();
      if (tracks.length !== 1 || !mp3 || await mp3.getCodec() !== 'mp3') throw Error('invalid');
      const actualDuration = Number(await mp3.computeDuration());
      if (!Number.isFinite(actualDuration) || actualDuration <= 0 ||
          actualDuration > MAX_SECONDS + 0.15 || Math.abs(actualDuration - duration) > .3)
        throw Error('duration');
      check();
      return {blob, duration};
    })()]);
  } catch (error) {
    if (stoppedError) throw stoppedError;
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
    verify?.dispose();
    input?.dispose();
  }
}

// Cancellation here exercises Mediabunny's cancel() contract. It does not yet
// establish that the embedded blob worker terminates after all edge cases.
// A disposable top-level worker or equivalent verified cleanup is mandatory
// before promoting this adapter into a publicly distributed application.
