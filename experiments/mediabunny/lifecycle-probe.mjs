// Test instrumentation only: delegates all media work to the native browser and
// the pinned encoder. No fabricated replies, worker replacements or polling.
export async function observeConversion(m, run, {onEncoded, failWrite = false} = {}) {
  const NativeWorker = globalThis.Worker;
  const workers = [], inputs = [], decoders = [];
  const NativeDecoder = globalThis.AudioDecoder;
  let encodedReplies = 0, encodedBytes = 0, encodeCommands = 0, flushCommands = 0;
  globalThis.Worker = class extends NativeWorker {
    constructor(...args) {
      super(...args);
      const record = {url: String(args[0]), terminated: false, commands: 0};
      workers.push(record);
      this.addEventListener('message', ({data}) => {
        if (data?.success && data.data?.type === 'encode') {
          encodedReplies++;
          encodedBytes += data.data.encodedData.byteLength;
          if (encodedBytes > 0) onEncoded?.();
        }
      });
      const post = this.postMessage.bind(this);
      this.postMessage = (...args) => {
        record.commands++;
        if(args[0]?.command?.type==='encode')encodeCommands++;
        if(args[0]?.command?.type==='flush')flushCommands++;
        return post(...args);
      };
      const terminate = this.terminate.bind(this);
      this.terminate = () => {record.terminated = true; return terminate();};
    }
  };
  globalThis.AudioDecoder = class extends NativeDecoder {
    constructor(...args) {super(...args); decoders.push(this);}
  };
  const observed = {
    ...m,
    Input: class extends m.Input {
      constructor(...args) {super(...args); this.released = false; inputs.push(this);}
      dispose() {this.released = true; return super.dispose();}
    },
    BufferTarget: class extends m.BufferTarget {
      constructor(...args) {
        super(...args);
        if (failWrite) this.onwrite = () => {throw Error('injected-output-write');};
      }
    },
  };
  let value, error;
  try {
    try {value = await run(observed);} catch (e) {error = e;}
    const metrics = {
      workersCreated: workers.length,
      workersTerminated: workers.filter(w => w.terminated).length,
      encodedReplies, encodedBytes, encodeCommands, flushCommands,
      inputsCreated: inputs.length,
      inputsDisposed: inputs.filter(i => i.released).length,
      decodersCreated: decoders.length,
      decodersClosed: decoders.filter(d => d.state === 'closed').length,
    };
    if (metrics.workersCreated !== metrics.workersTerminated ||
        metrics.inputsCreated !== metrics.inputsDisposed ||
        metrics.decodersCreated !== metrics.decodersClosed)
      throw Error('Resource cleanup failed at promise settlement: ' + JSON.stringify(metrics));
    return {value, error, metrics};
  } finally {
    globalThis.Worker = NativeWorker;
    globalThis.AudioDecoder = NativeDecoder;
  }
}
