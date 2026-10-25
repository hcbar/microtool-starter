const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_PIXELS = 24_000_000;
const HEADER_SCAN_BYTES = 256 * 1024;
const aborted = signal => { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError'); };
const uint16BE = (a, i) => a[i] * 256 + a[i + 1];
const uint24LE = (a, i) => a[i] + a[i + 1] * 256 + a[i + 2] * 65536;
const uint32BE = (a, i) => (a[i] * 16777216 + a[i + 1] * 65536 + a[i + 2] * 256 + a[i + 3]);
const ascii = (a, offset, value) => [...value].every((c, i) => a[offset + i] === c.charCodeAt(0));
const isJpegSOF = marker => [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker);

// Only read a bounded prefix. Headers with dimensions allow rejecting image bombs
// before invoking native decoders; unsupported layouts still get a post-decode cap.
async function inspectInput(file) {
  const b = new Uint8Array(await file.slice(0, HEADER_SCAN_BYTES).arrayBuffer());
  let size = null;
  if (file.type === 'image/png') {
    if (b.length < 24 || ![137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v) || !ascii(b,12,'IHDR')) throw new Error('Invalid PNG header');
    size = [uint32BE(b,16),uint32BE(b,20)];
  } else if (file.type === 'image/jpeg') {
    if (b.length < 4 || b[0]!==0xff || b[1]!==0xd8 || b[2]!==0xff) throw new Error('Invalid JPEG header');
    let pos=2;
    while(pos+3<b.length) {
      if(b[pos]!==0xff) break;
      while(pos<b.length && b[pos]===0xff) pos++;
      if(pos>=b.length) break;
      const marker=b[pos++];
      if(marker===0xd9 || marker===0xda) break;
      if(marker===0x01 || (marker>=0xd0 && marker<=0xd7)) continue;
      if(pos+2>b.length) break;
      const length=uint16BE(b,pos);
      if(length<2) throw new Error('Invalid JPEG segment');
      if(pos+length>b.length) break;
      if(isJpegSOF(marker)) {
        if(length<7) throw new Error('Invalid JPEG size');
        size=[uint16BE(b,pos+3),uint16BE(b,pos+5)]; // height, width
        break;
      }
      pos+=length;
    }
  } else if (file.type === 'image/webp') {
    if(b.length<20 || !ascii(b,0,'RIFF') || !ascii(b,8,'WEBP')) throw new Error('Invalid WebP header');
    if(ascii(b,12,'VP8X') && b.length>=30) size=[uint24LE(b,24)+1,uint24LE(b,27)+1];
    else if(ascii(b,12,'VP8L') && b.length>=25 && b[20]===0x2f) size=[1+b[21]+((b[22]&63)<<8),1+(b[22]>>6)+(b[23]<<2)+((b[24]&15)<<10)];
    else if(ascii(b,12,'VP8 ') && b.length>=30 && b[23]===0x9d && b[24]===0x01 && b[25]===0x2a) size=[(b[26]+b[27]*256)&0x3fff,(b[28]+b[29]*256)&0x3fff];
  }
  if(size && (!size[0] || !size[1] || size[0]*size[1]>MAX_PIXELS)) throw new Error('Image dimensions exceed limit');
}

function encode(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('JPEG encoding failed')), 'image/jpeg', quality);
  });
}

// Native decoders/encoders cannot be forcibly cancelled. Signals gate each pass;
// already-running native operations may finish before the caller discards them.
export async function compressImageToTarget(file, targetBytes, {signal} = {}) {
  aborted(signal);
  if (!(file instanceof Blob) || !Number.isFinite(targetBytes) || targetBytes < 1024 || targetBytes > 20 * 1024 * 1024) throw new Error('Invalid target');
  if (file.size > MAX_INPUT_BYTES || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Unsupported file');
  await inspectInput(file);
  aborted(signal);
  // No unchecked JPEG fast-path: even small files must be decoded, dimension-
  // validated and re-encoded, so an invalid payload is not offered as a JPEG.
  const bitmap = await createImageBitmap(file);
  try {
    aborted(signal);
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_PIXELS) throw new Error('Image too large');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', {alpha:false});
    if (!ctx) throw new Error('Canvas unavailable');
    let scale = Math.min(1, Math.sqrt(12_000_000 / (bitmap.width * bitmap.height)));
    let bestEligible = null, smallest = null;
    for (let pass = 0; pass < 7; pass++) {
      aborted(signal);
      canvas.width = Math.max(1, Math.floor(bitmap.width * scale));
      canvas.height = Math.max(1, Math.floor(bitmap.height * scale));
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      let lo = .35, hi = .92;
      for (let step = 0; step < 7; step++) {
        aborted(signal);
        const q = (lo + hi) / 2;
        const blob = await encode(canvas, q);
        aborted(signal);
        if (!smallest || blob.size < smallest.size) smallest = blob;
        if (blob.size <= targetBytes) { bestEligible = blob; lo = q; } else hi = q;
      }
      if (bestEligible) break;
      scale *= .76;
    }
    const best = bestEligible || smallest;
    if (!best) throw new Error('No output');
    aborted(signal);
    return {blob:best, reachedTarget:Boolean(bestEligible)};
  } finally { bitmap.close(); }
}
