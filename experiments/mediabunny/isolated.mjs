import {validateCandidateFile} from './adapter.mjs';

// Chromium can spend ~2 s forcibly interrupting a busy worker. Reserve this
// measured shutdown budget INSIDE the total deadline, not after it. Browser
// tests independently require target destruction before forced-stop settlement.
export const FORCE_STOP_MS = 3000;

// Experimental only; no production imports or encoder binaries in this module.
// The deadline lives outside ALL media work. Never wait for cooperative cleanup
// on abort/timeout: terminate both page-owned workers and close the bridge ports.
export async function convertIsolated(file, {
  signal, mobile = false, timeoutMs = 120000, onStage = () => {},
  workerURL = new URL('./isolated-worker.mjs', import.meta.url),
  encoderURL = new URL('./pinned-build/encode.worker.js', import.meta.url),
} = {}) {
  validateCandidateFile(file, mobile);
  signal?.throwIfAborted();
  if (!Number.isFinite(timeoutMs) || timeoutMs <= FORCE_STOP_MS) throw Error('timeout');
  // URL injection is for the bounded browser fault harness, never remote code.
  for (const url of [workerURL, encoderURL]) {
    const parsed = new URL(url, import.meta.url);
    if (parsed.origin !== location.origin || !['http:', 'https:'].includes(parsed.protocol)) throw Error('worker-origin');
  }
  return new Promise((resolve, reject) => {
    let worker, encoder, port, settled = false;
    const finish = (error, value, forced = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      // Independent handles: no reliance on nested-worker cascade or callbacks.
      encoder?.terminate();
      worker?.terminate();
      port?.close();
      const settle = () => {if (error) reject(error); else resolve(value);};
      if (forced && worker) {
        // No cleanup acknowledgment is requested from unresponsive media code.
        // This is a bounded native-shutdown allowance, not cooperative polling.
        try {onStage('stopping', {shutdownMs: FORCE_STOP_MS});} catch {}
        setTimeout(settle, FORCE_STOP_MS);
      } else settle();
    };
    const abort = () => finish(new DOMException('Cancelled', 'AbortError'), undefined, true);
    const timer = setTimeout(() => finish(Error('timeout'), undefined, true), timeoutMs - FORCE_STOP_MS);
    const stage = (name, detail) => {try {onStage(name, detail);} catch (error) {finish(error, undefined, true);}};
    signal?.addEventListener('abort', abort, {once: true});
    try {
      worker = new Worker(workerURL, {type: 'module'});
      worker.onerror = event => {event.preventDefault(); finish(Error(event.message || 'conversion-worker'), undefined, true);};
      worker.onmessageerror = () => finish(Error('conversion-message'), undefined, true);
      worker.onmessage = ({data}) => {
        if (settled) return;
        try {
          if (data.type === 'spawn-encoder') {
            if (encoder || port || !data.port) throw Error('encoder-protocol');
            port = data.port;
            encoder = new Worker(encoderURL);
            encoder.onerror = event => {event.preventDefault(); finish(Error(event.message || 'encoder-worker'), undefined, true);};
            encoder.onmessageerror = () => finish(Error('encoder-message'), undefined, true);
            encoder.onmessage = ({data: reply}) => {
              if (settled) return;
              if (reply.success && reply.data?.type === 'encode' && reply.data.encodedData.byteLength)
                stage('encoding', {bytes: reply.data.encodedData.byteLength});
              if (settled) return;
              const buffer = reply.data?.encodedData ?? reply.data?.flushedData;
              port.postMessage({type: 'reply', data: reply}, buffer instanceof ArrayBuffer ? [buffer] : []);
            };
            port.onmessage = ({data: command}) => {
              if (settled) return;
              try {
                if (command.type === 'terminate') {encoder.terminate(); return;}
                if (command.type !== 'command') throw Error('encoder-protocol');
                const buffer = command.data.command?.data?.audioData;
                encoder.postMessage(command.data, buffer instanceof ArrayBuffer ? [buffer] : []);
              } catch (error) {finish(error, undefined, true);}
            };
          } else if (data.type === 'stage') stage(data.stage);
          else if (data.type === 'result') finish(null, data.result);
          else if (data.type === 'failure') finish(new DOMException(data.message, data.name));
          else throw Error('conversion-protocol');
        } catch (error) {finish(error, undefined, true);}
      };
      worker.postMessage({file, mobile});
    } catch (error) {finish(error, undefined, true);}
  });
}
