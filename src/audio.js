export const MAX_SECONDS = 360;
export const limitsFor = mobile => (mobile ? 25 : 50) * 1024 ** 2;
export function validateInput(file, mobile = false) {
  if (!file || !/\.(mp4|m4a|ogg|opus)$/i.test(file.name)) throw Error('format');
  if (!file.size || file.size > limitsFor(mobile)) throw Error('size');
}
export function validateProbe(info) {
  if (!info.format?.format_name) throw Error('invalid');
  if (!/^(mov,mp4,m4a,3gp,3g2,mj2|ogg)$/.test(info.format?.format_name)) throw Error('format');
  const audio = info.streams?.find(s => s.codec_type === 'audio');
  if (!audio) throw Error('audio');
  if (!['aac','opus','vorbis'].includes(audio.codec_name)) throw Error('format');
  // Stream duration is a length, not an end timestamp: never subtract
  // start_time or compare against a container that may include longer video.
  const present = value => value !== undefined && value !== null && value !== '' && value !== 'N/A';
  if (present(audio.start_time) && !Number.isFinite(Number(audio.start_time))) throw Error('duration');
  let duration = Number(audio.duration);
  if (!present(audio.duration)) {
    const parts = String(audio.time_base).split('/').map(Number);
    if (!present(audio.duration_ts) || parts.length !== 2 || !parts.every(n => Number.isFinite(n) && n > 0)) throw Error('duration');
    duration = Number(audio.duration_ts) * parts[0] / parts[1];
  }
  // Missing or invalid selected-track timing is rejected conservatively.
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_SECONDS) throw Error('duration');
  return duration;
}
async function createCodec() {
  const {FFmpeg} = await import('./ffmpeg/index.js');
  return new FFmpeg();
}
// Each operation owns a disposable worker and filesystem. Termination frees WASM,
// temporary inputs and outputs on success, failure, cancellation and timeout.
export async function convertToMP3(file, {
  signal, mobile = false, onStage = () => {}, timeoutMs = 120000,
  createCodec: makeCodec = createCodec
} = {}) {
  validateInput(file, mobile);
  signal?.throwIfAborted();
  let ff, timer, reader, rejectStop, stoppedError;
  const stopped = new Promise((_, reject) => { rejectStop = reject; });
  const stop = error => { stoppedError = error; reader?.abort(); rejectStop(error); };
  const abort = () => stop(new DOMException('Cancelled', 'AbortError'));
  signal?.addEventListener('abort', abort, {once:true});
  timer = setTimeout(() => stop(Error('timeout')), timeoutMs);
  const check = () => { if (stoppedError) throw stoppedError; signal?.throwIfAborted(); };
  const read = () => typeof FileReader === 'undefined' ? file.arrayBuffer() : new Promise((resolve,reject) => {
    reader = new FileReader();reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(Error('invalid'));reader.onabort = () => reject(new DOMException('Cancelled','AbortError'));
    reader.readAsArrayBuffer(file);
  });
  try {
    return await Promise.race([stopped, (async () => {
      onStage('loading');
      ff = await makeCodec();
      if (stoppedError) {ff.terminate();ff = null;throw stoppedError;}
      check();
      const origin = globalThis.location?.origin || 'http://localhost';
      try {await ff.load({coreURL:origin+'/assets/core/ffmpeg-core.js',wasmURL:origin+'/assets/core/ffmpeg-core.wasm'});}
      catch {throw Error('codec');}
      check();
      onStage('checking');
      const header = new Uint8Array(await file.slice(0,12).arrayBuffer()); check();
      const text = new TextDecoder('ascii').decode(header);
      if (!text.startsWith('OggS') && text.slice(4,8) !== 'ftyp') throw Error('invalid');
      await ff.writeFile('input', new Uint8Array(await read())); check();
      const probeArgs = ['-v','error','-protocol_whitelist','file,pipe','-format_whitelist','mov,ogg','-show_format','-show_streams','-of','json','-o','probe.json','input'];
      // Core 0.12.10 ffprobe returns -1 even on valid JSON; validate the
      // generated document instead of treating that status as an exit code.
      await ff.ffprobe(probeArgs); check();
      const duration = validateProbe(JSON.parse(await ff.readFile('probe.json','utf8'))); check();
      onStage('converting');
      // Do not trust container duration alone. Bound actual decoded output too;
      // an overlong result is rejected, never silently returned as a truncation.
      const args = ['-v','error','-protocol_whitelist','file,pipe','-format_whitelist','mov,ogg','-i','input','-map','0:a:0','-vn','-sn','-dn','-map_metadata','-1','-af','asetpts=PTS-STARTPTS','-t','361','-ac','2','-ar','44100','-c:a','libmp3lame','-b:a','128k','-f','mp3','output.mp3'];
      if (await ff.exec(args) !== 0) throw Error('invalid'); check();
      await ff.ffprobe(['-v','error','-show_format','-show_streams','-of','json','-o','output.json','output.mp3']);
      const output = JSON.parse(await ff.readFile('output.json','utf8'));
      if (output.format?.format_name !== 'mp3' || output.streams?.length !== 1 || output.streams[0].codec_name !== 'mp3' || output.streams[0].codec_type !== 'audio') throw Error('invalid');
      const actual = Number(output.format?.duration);
      if (!Number.isFinite(actual) || actual <= 0 || actual > MAX_SECONDS + .15 || Math.abs(actual-duration) > .3) throw Error('duration');
      const data = await ff.readFile('output.mp3'); check();
      if (!(data instanceof Uint8Array) || data.length < 100 || data.length > 6 * 1024 ** 2) throw Error('invalid');
      return {blob:new Blob([data],{type:'audio/mpeg'}),duration};
    })()]);
  } finally {
    clearTimeout(timer);signal?.removeEventListener('abort',abort);
    ff?.terminate();
  }
}
