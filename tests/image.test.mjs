import test from 'node:test';
import assert from 'node:assert/strict';
import {compressImageToTarget} from '../src/image.js';

function pngHeader(width, height) {
  const a = new Uint8Array(33);
  a.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
  const dv = new DataView(a.buffer);dv.setUint32(16,width);dv.setUint32(20,height);
  return new Blob([a],{type:'image/png'});
}
function jpegHeader(width,height) {
  const a=new Uint8Array([255,216,255,192,0,17,8,0,0,0,0,3,1,17,0,2,17,0,3,17,0]);
  a[7]=height>>8;a[8]=height&255;a[9]=width>>8;a[10]=width&255;
  return new Blob([a],{type:'image/jpeg'});
}
function webpHugeHeader() {
  const a=new Uint8Array(30);a.set([82,73,70,70,22,0,0,0,87,69,66,80,86,80,56,88]);
  a.set([255,255,255,255,255,255],24);
  return new Blob([a],{type:'image/webp'});
}

test('F1: JPEG MIME alone cannot bypass validation for small files', async()=>{
  const original=globalThis.createImageBitmap;
  let calls=0;
  globalThis.createImageBitmap=async()=>{calls++;throw new Error('decoder should not run');};
  try {
    await assert.rejects(compressImageToTarget(new Blob(['not a jpeg'],{type:'image/jpeg'}),1024),/Invalid JPEG header/);
    assert.equal(calls,0);
  }finally {globalThis.createImageBitmap=original;}
});

test('F1: plausible JPEG header is not accepted without decoding', async()=>{
  const original=globalThis.createImageBitmap;
  let calls=0;
  globalThis.createImageBitmap=async()=>{calls++;throw new Error('decoder rejected truncated JPEG');};
  try {
    await assert.rejects(compressImageToTarget(jpegHeader(1,1),1024),/decoder rejected/);
    assert.equal(calls,1);
  }finally {globalThis.createImageBitmap=original;}
});

test('F6: tiny PNG/JPEG/WebP files with oversized announced dimensions are rejected before decode',async()=>{
  const original=globalThis.createImageBitmap;
  let calls=0;
  globalThis.createImageBitmap=async()=>{calls++;throw new Error('unexpected decoder');};
  try {
    for(const file of [pngHeader(30000,30000),jpegHeader(10000,10000),webpHugeHeader()]) {
      await assert.rejects(compressImageToTarget(file,1024),/dimensions exceed limit/);
    }
    assert.equal(calls,0);
  }finally {globalThis.createImageBitmap=original;}
});

test('F7: rejects too-large input, unsupported format, aborted operation and malformed PNG',async()=>{
  await assert.rejects(compressImageToTarget(new Blob([new Uint8Array(25*1024*1024+1)],{type:'image/png'}),1024),/Unsupported file/);
  await assert.rejects(compressImageToTarget(new Blob(['bad'],{type:'image/svg+xml'}),1024),/Unsupported file/);
  await assert.rejects(compressImageToTarget(new Blob(['bad'],{type:'image/png'}),1024),/Invalid PNG header/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(compressImageToTarget(pngHeader(1,1),1024,{signal:controller.signal}),{name:'AbortError'});
});
