import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCandidateFile,selectedAudioWindow,convertCandidate} from './adapter.mjs';

const file={name:'tone.ogg',size:1024};
test('candidate validates extensions, size, and mobile caps',()=>{
  assert.doesNotThrow(()=>validateCandidateFile(file));
  for(const f of [{name:'x.wav',size:10},{name:'x.mp4',size:0},{name:'x.mp4',size:51*1024**2}])
    assert.throws(()=>validateCandidateFile(f));
  assert.throws(()=>validateCandidateFile({name:'tone.opus',size:26*1024**2},true),/size/);
});
test('duration handles shifted MP4 audio separately from video',()=>{
  assert.deepEqual(selectedAudioWindow(3,5),{start:3,end:5,duration:2});
  assert.deepEqual(selectedAudioWindow(0,2),{start:0,end:2,duration:2});
  for(const pair of [[2,2],[0,361],[-1,3],[0,NaN]])
    assert.throws(()=>selectedAudioWindow(...pair),/duration/);
});
function mock({codec='opus',audio=true,decodable=true,outputDuration=2,execute,tracks=1}={}){
  const info={disposes:0,cancels:0,register:0};
  class Input {
    constructor({formats}){this.output=Array.isArray(formats)&&formats.length===1;}
    async getPrimaryAudioTrack(){
      if(!audio&&!this.output)return null;
      return {
        getCodec:async()=>this.output?'mp3':codec,
        canDecode:async()=>decodable,
        getFirstTimestamp:async()=>3,
        computeDuration:async()=>this.output?outputDuration:5,
      };
    }
    async getTracks(){return Array.from({length:tracks},()=>({}));}
    dispose(){info.disposes++;}
  }
  class Conversion {
    static async init(){return new Conversion();}
    isValid=true;
    async execute(){if(execute)return execute(); }
    async cancel(){info.cancels++;}
  }
  class BufferTarget {buffer=new ArrayBuffer(1000);}
  return {m:{Input,Conversion,BufferTarget,BlobSource:class{},Output:class{},Mp3OutputFormat:class{},ALL_FORMATS:[],MP3:'mp3'},registerMp3Encoder:()=>{info.register++},info};
}
test('real conversion contract returns MP3 and releases both inputs',async()=>{
  const {m,registerMp3Encoder,info}=mock();
  const stages=[];
  const result=await convertCandidate(file,{mediabunny:m,registerMp3Encoder,onStage:s=>stages.push(s)});
  assert.equal(result.blob.type,'audio/mpeg');
  assert.equal(result.duration,2);
  assert.equal(info.disposes,2);
  assert.equal(info.register,1);
  assert.deepEqual(stages,['checking','converting']);
});
test('reject unsupported codec, missing audio, decoder, output duration',async()=>{
  for(const opts of [{codec:'flac'},{audio:false},{decodable:false},{outputDuration:3.1}]){
    const {m,registerMp3Encoder,info}=mock(opts);
    await assert.rejects(convertCandidate(file,{mediabunny:m,registerMp3Encoder}));
    assert.ok(info.disposes>=1);
  }
});
test('pre-abort prevents codec initialization',async()=>{
  const controller=new AbortController();controller.abort();
  let invoked=false;
  await assert.rejects(convertCandidate(file,{signal:controller.signal,mediabunny:{},registerMp3Encoder:()=>{invoked=true;}}),{name:'AbortError'});
  assert.equal(invoked,false);
});
test('cancel and timeout call library cancellation',async()=>{
  for(const cancel of [true,false]){
    const {m,registerMp3Encoder,info}=mock({execute:()=>new Promise(()=>{})});
    const controller=new AbortController();
    const result=convertCandidate(file,{mediabunny:m,registerMp3Encoder,signal:controller.signal,timeoutMs:cancel?1000:10});
    if(cancel)setTimeout(()=>controller.abort(),5);
    await assert.rejects(result,cancel?{name:'AbortError'}:/timeout/);
    await new Promise(ok=>setTimeout(ok,0));
    assert.equal(info.cancels,1);
  }
});
