const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_PIXELS = 24_000_000;
const aborted = signal => { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError'); };
function encode(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('JPEG encoding failed')), 'image/jpeg', quality);
  });
}

// The browser's native decoder/encoder cannot be forcibly cancelled. The
// signal gates each expensive pass and prevents a superseded result from being
// published by its caller. A native operation already in flight may finish.
export async function compressImageToTarget(file, targetBytes, {signal} = {}) {
  aborted(signal);
  if (!(file instanceof Blob) || !Number.isFinite(targetBytes) || targetBytes < 1024 || targetBytes > 20 * 1024 * 1024) throw new Error('Invalid target');
  if (file.size > MAX_INPUT_BYTES || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Unsupported file');
  if (file.type === 'image/jpeg' && file.size <= targetBytes) return {blob:file, reachedTarget:true};
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
