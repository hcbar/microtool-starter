import test from 'node:test';
import assert from 'node:assert/strict';
import {convertToMP3, validateInput, validateProbe, limitsFor} from '../src/audio.js';
const probe={format:{format_name:'ogg',duration:'2'},streams:[{codec_type:'audio',codec_name:'opus',duration:'2'}]};
test('limits reject empty, oversize, unsupported before reading',()=>{
  for(const f of [{name:'x.mp4',size:0},{name:'x.mp4',size:50*1024**2+1},{name:'x.wav',size:1}]) assert.throws(()=>validateInput(f));
  assert.equal(limitsFor(true),25*1024**2);assert.equal(limitsFor(false),50*1024**2);
  assert.throws(()=>validateInput({name:'x.ogg',size:26*1024**2},true),/size/);
});
test('content probe requires supported container, audio and bounded duration',()=>{
  assert.equal(validateProbe(probe),2);
  assert.equal(validateProbe({...probe,format:{format_name:'ogg',duration:'NaN'}}),2);
  const track = fields => ({...probe,streams:[{codec_type:'audio',codec_name:'opus',...fields}]});
  assert.equal(validateProbe(track({duration_ts:'96000',time_base:'1/48000',start_time:'3'})),2);
  for(const p of [{...probe,streams:[]},{...probe,format:{format_name:'wav',duration:'2'}},track({}),track({duration:'NaN'}),track({duration:'361'}),track({duration:'0'}),track({duration:'2',start_time:'bad'}),track({duration_ts:'96000',time_base:'1/0'}),{...probe,streams:[{codec_type:'audio',codec_name:'mp3'}]}]) assert.throws(()=>validateProbe(p));
});
function fake({loadError=false,stall=false,exit=0}={}) {
  return {terminated:0,calls:[],on(){},async load(){if(loadError) throw Error('load');if(stall) await new Promise(()=>{});},async writeFile(){},async ffprobe(){return 0;},async exec(args){this.calls.push(args);return exit;},async readFile(name){return name.endsWith('.json')?JSON.stringify(probe):new Uint8Array([1,2,3]);},terminate(){this.terminated++;}};
}
const file={name:'sample.ogg',size:10,slice(){return new Blob(['OggSxxxxxx']);},async arrayBuffer(){return new ArrayBuffer(10);}};
test('abort, codec failure, conversion failure and timeout terminate worker',async()=>{
  for(const opts of [{loadError:true},{exit:1},{stall:true}]){
    const ff=fake(opts);await assert.rejects(convertToMP3(file,{createCodec:async()=>ff,timeoutMs:20}));assert.equal(ff.terminated,1);
  }
  const ff=fake({stall:true}),controller=new AbortController();
  const work=convertToMP3(file,{createCodec:async()=>ff,signal:controller.signal});
  setTimeout(()=>controller.abort(),5);await assert.rejects(work,{name:'AbortError'});assert.equal(ff.terminated,1);
});
test('pre-aborted job does not load a worker',async()=>{
  const c=new AbortController();c.abort();let called=false;
  await assert.rejects(convertToMP3(file,{signal:c.signal,createCodec:async()=>{called=true;}}),{name:'AbortError'});assert.equal(called,false);
});
test('late codec creation after timeout is terminated without starting load',async()=>{
  const ff=fake();let loaded=false;ff.load=async()=>{loaded=true;};
  await assert.rejects(convertToMP3(file,{timeoutMs:5,createCodec:()=>new Promise(ok=>setTimeout(()=>ok(ff),20))}),/timeout/);
  await new Promise(ok=>setTimeout(ok,25));assert.equal(ff.terminated,1);assert.equal(loaded,false);
});
test('valid ffprobe JSON despite -1 status yields audio/mpeg and releases worker',async()=>{
  const ff=fake();ff.ffprobe=async()=>-1;
  ff.readFile=async name=>name==='probe.json'?JSON.stringify(probe):name==='output.json'?JSON.stringify({format:{format_name:'mp3',duration:'2.04'},streams:[{codec_name:'mp3',codec_type:'audio'}]}):new Uint8Array(1000);
  const out=await convertToMP3(file,{createCodec:async()=>ff});
  assert.equal(out.blob.type,'audio/mpeg');assert.equal(out.duration,2);assert.equal(ff.terminated,1);
});
test('oversize input never initializes a codec',async()=>{
  let called=false;await assert.rejects(convertToMP3({...file,size:51*1024**2},{createCodec:async()=>{called=true;}}),/size/);assert.equal(called,false);
});
test('timeout terminates execution, not just a loading promise',async()=>{
  const ff=fake();ff.exec=async()=>new Promise(()=>{});
  await assert.rejects(convertToMP3(file,{createCodec:async()=>ff,timeoutMs:10}),/timeout/);assert.equal(ff.terminated,1);
});
