// Only the pinned encoder's createWorker import uses this bridge. Native workers
// are owned by the page, so a stuck conversion worker cannot prevent termination.
export function createEncoderWorker() {
  const {port1, port2} = new MessageChannel();
  class EncoderPort extends EventTarget {
    constructor() {
      super();
      port2.onmessage = ({data}) => {
        if (data.type === 'reply') this.dispatchEvent(new MessageEvent('message', {data: data.data}));
      };
    }
    postMessage(data, transfer = []) {port2.postMessage({type: 'command', data}, transfer);}
    terminate() {port2.postMessage({type: 'terminate'}); port2.close();}
  }
  const encoder = new EncoderPort();
  self.postMessage({type: 'spawn-encoder', port: port1}, [port1]);
  return encoder;
}
