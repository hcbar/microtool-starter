// Browser harness only. The HTTP test server injects this before worker code;
// candidate modules never import it. All normal operations delegate to natives.
(() => {
  const emit = (event, detail = {}) => console.debug('isolation-probe ' + JSON.stringify({event, scope: location.pathname, ...detail}));
  const fault = new URL(location.href).searchParams.get('fault');
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => {const url = create(blob); emit('url-created', {url}); return url;};
  URL.revokeObjectURL = url => {revoke(url); emit('url-revoked', {url});};
  if (typeof document !== 'undefined') {
    const NativeWorker = Worker;
    self.Worker = class extends NativeWorker {
      constructor(...args) {super(...args); emit('page-worker-created', {url: String(args[0])});}
    };
  }
  self.addEventListener('securitypolicyviolation', event => emit('csp', {directive: event.violatedDirective, blocked: event.blockedURI}));
  if (typeof AudioDecoder !== 'undefined') {
    const Native = AudioDecoder;
    self.AudioDecoder = class extends Native {
      constructor(...args) {super(...args); emit('decoder-created');}
      close() {super.close(); emit('decoder-closed');}
      decode(chunk) {
        super.decode(chunk);
        if (fault === 'decoder-hang') {emit('hang', {where: 'decoder'}); while (true) { /* intentional test stall */ }}
      }
    };
  }
  if (typeof document === 'undefined') {
    const instantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async (bytes, ...rest) => {
      if (bytes instanceof ArrayBuffer || ArrayBuffer.isView(bytes)) {
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        emit('wasm', {sha256: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')});
      }
      return instantiate.call(WebAssembly, bytes, ...rest);
    };
    let encodes = 0;
    if (location.pathname.endsWith('/encode.worker.js')) {
      self.addEventListener('message', ({data}) => {
        if (data.command?.type === 'encode' && ++encodes === 2) {
          if (fault === 'codec-error') throw Error('controlled-codec-error');
          if (fault === 'codec-hang' || fault === 'both-hang') {
            emit('hang', {where: 'codec'}); while (true) { /* intentional test stall */ }
          }
        }
      });
    } else if (fault === 'both-hang') {
      const post = MessagePort.prototype.postMessage;
      MessagePort.prototype.postMessage = function(data, ...rest) {
        const result = post.call(this, data, ...rest);
        if (data.type === 'command' && data.data?.command?.type === 'encode' && ++encodes === 2) {
          emit('hang', {where: 'conversion'}); while (true) { /* intentional test stall */ }
        }
        return result;
      };
    }
  }
})();
