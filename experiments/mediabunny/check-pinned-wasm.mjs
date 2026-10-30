// Extract the actual WebAssembly bytes used by the exact pinned Emscripten module.
// Does not accept metadata strings or a hash of the JS wrapper as proof.
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const EXPECTED='a680e507e9d91f1a4dcd6f846b9b94ff1fec7e19ff44e803358c218ddbe446a6';
const modulePath=process.argv[2];
if (!modulePath) throw Error('Expected built lame.js path');
let observed=false;
const original=WebAssembly.instantiate;
WebAssembly.instantiate=async input=>{
  const bytes=input instanceof ArrayBuffer ? new Uint8Array(input)
    : input instanceof Uint8Array ? input
    : ArrayBuffer.isView(input) ? new Uint8Array(input.buffer,input.byteOffset,input.byteLength)
    : null;
  if (!bytes || bytes[0]!==0 || bytes[1]!==97 || bytes[2]!==115 || bytes[3]!==109)
    throw Error('WebAssembly input was not a WASM binary');
  const hash=createHash('sha256').update(bytes).digest('hex');
  if (hash!==EXPECTED) throw Error('WASM SHA-256 mismatch: '+hash);
  observed=true;
  console.log('PASS: pinned WASM bytes='+bytes.byteLength+' SHA256='+hash);
  // Do not actually instantiate: the tested binary was already captured.
  throw Error('__VERIFIED_WASM_STOP__');
};
try {
  const loaded=await import(pathToFileURL(resolve(modulePath)).href);
  const factory=loaded.default;
  if(typeof factory!=='function') throw Error('Expected Emscripten factory export');
  await factory();
} catch (e) {
  if(!observed) throw e;
} finally {
  WebAssembly.instantiate=original;
}
if(!observed) throw Error('No WebAssembly.instantiate call was intercepted');
