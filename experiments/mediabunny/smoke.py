"""Bounded codec spike. Run with the repository's locked Python 3.12 harness.
Serves only on loopback; does not change the product build or its CSP.
"""
import functools, http.server, json, os, threading, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'test-results/mediabunny'
BASE = '/experiments/mediabunny/node_modules/'
CORE_MODULE = os.getenv('MEDIABUNNY_CORE_MODULE', BASE + 'mediabunny/dist/bundles/mediabunny.min.mjs')
ENCODER_MODULE = os.getenv('MEDIABUNNY_ENCODER_MODULE', BASE + '@mediabunny/mp3-encoder/dist/bundles/mediabunny-mp3-encoder.mjs')
CANDIDATE_ADAPTER = os.getenv('MEDIABUNNY_CANDIDATE_ADAPTER') == '1'

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        if self.path == '/spike':
            imports = {'imports': {'mediabunny': CORE_MODULE, 'mediabunny-mp3-encoder': ENCODER_MODULE}}
            body = ('<!doctype html><script type="importmap">' + json.dumps(imports)
                    + '</script><script>window.__candidateAdapter='
                    + ('true' if CANDIDATE_ADAPTER else 'false') + '</script>').encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            self.wfile.write(body)
        else: super().do_GET()

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=['--no-sandbox'])
            page = browser.new_page()
            requests = []
            page.on('request', lambda r: requests.append({'url':r.url, 'method':r.method, 'body':r.post_data}))
            page.goto(origin + '/spike')
            # Generate the two P2 regression inputs with the existing pinned core.
            page.evaluate('''async () => {
              const {FFmpeg}=await import('/dist/assets/ffmpeg/index.js');
              const ff=new FFmpeg(); window.regressions=[];
              try {
                await ff.load({coreURL:location.origin+'/dist/assets/core/ffmpeg-core.js',wasmURL:location.origin+'/dist/assets/core/ffmpeg-core.wasm'});
                for(const offset of [0,3]) {
                  const args=['-f','lavfi','-i','color=c=blue:s=32x32:d=5'];
                  if(offset) args.push('-itsoffset',String(offset));
                  args.push('-f','lavfi','-i','sine=frequency=440:duration=2:sample_rate=48000','-map','0:v:0','-map','1:a:0','-c:v','mpeg4','-c:a','aac','-y','regression.mp4');
                  if(await ff.exec(args)!==0) throw Error('fixture generation');
                  window.regressions.push(new File([await ff.readFile('regression.mp4')],`video5-audio2-offset${offset}.mp4`));
                }
              } finally {ff.terminate();}
            }''')
            start = time.monotonic()
            result = page.evaluate('''async () => {
              const m=await import('mediabunny');
              const {registerMp3Encoder}=await import('mediabunny-mp3-encoder');
              if (!window.__candidateAdapter) registerMp3Encoder();
              const adapter = window.__candidateAdapter ? await import('/experiments/mediabunny/adapter.mjs') : null;
              const files=[];
              for(const name of ['tone.mp4','tone.m4a','tone.ogg','tone.opus','tone-vorbis.ogg']) {
                files.push(new File([await (await fetch('/tests/fixtures/'+name)).blob()],name));
              }
              files.push(...window.regressions);
              const records=[];
              for(const file of files) {
                const start=performance.now();let input;
                try {
                  input=new m.Input({source:new m.BlobSource(file),formats:m.ALL_FORMATS});
                  const track=await input.getPrimaryAudioTrack();
                  if(!track) throw Error('no audio');
                  const codec=await track.getCodec();const canDecode=await track.canDecode();
                  if(!canDecode) {records.push({name:file.name,codec,canDecode,status:'UNSUPPORTED_DECODER'});continue;}
                  const first=await track.getFirstTimestamp();const end=await track.computeDuration();
                  let blob;
                  if (adapter) {
                    blob=(await adapter.convertCandidate(file,{mediabunny:m,registerMp3Encoder})).blob;
                  } else {
                    const target=new m.BufferTarget();
                    const output=new m.Output({format:new m.Mp3OutputFormat(),target});
                    const conversion=await m.Conversion.init({input,output,tracks:'primary',video:{discard:true},audio:{codec:'mp3',bitrate:128000,sampleRate:44100,numberOfChannels:2},trim:{start:Math.max(0,first),end},tags:{}});
                    if(!conversion.isValid) throw Error(JSON.stringify(conversion.discardedTracks));
                    await conversion.execute();
                    blob=new Blob([target.buffer],{type:'audio/mpeg'});
                  }
                  const check=new m.Input({source:new m.BlobSource(blob),formats:[m.MP3]});
                  const outTracks=await check.getTracks();
                  const outputCodec=await (await check.getPrimaryAudioTrack()).getCodec();
                  check.dispose();
                  const ac=new AudioContext();
                  const decoded=await ac.decodeAudioData(await blob.arrayBuffer());await ac.close();
                  const samples=decoded.getChannelData(0);let energy=0;for(const v of samples) energy+=v*v;
                  const rms=Math.sqrt(energy/samples.length);
                  const record={name:file.name,status:'PASS',codec,canDecode,first,end,bytes:blob.size,type:blob.type,outputCodec,tracks:outTracks.length,duration:decoded.duration,rms,ms:Math.round(performance.now()-start)};
                  if(outputCodec!=='mp3'||outTracks.length!==1||Math.abs(decoded.duration-2)>.15||rms<.01) throw Error(JSON.stringify(record));
                  records.push(record);
                } catch(e) {records.push({name:file.name,status:'FAIL',error:String(e)});}
                finally {input?.dispose();}
              }
              const checks=[];
              if (adapter) {
                // Reject invalid inputs BEFORE loading an encoder. The source-only
                // adapter's error keys remain the application's expected contract.
                for(const [name,bytes,expected] of [
                  ['wrong.wav',new Uint8Array([1,2,3]),'format'],
                  ['empty.ogg',new Uint8Array(0),'size'],
                ]) {
                  let seen=null;
                  try {
                    await adapter.convertCandidate(new File([bytes],name),{mediabunny:m,registerMp3Encoder});
                  } catch(e) {seen=e?.message;}
                  if(seen!==expected)throw Error('Validation '+name+': '+seen);
                  checks.push({name,status:'PASS',error:seen});
                }
                let noAudio=null;
                try {
                  const silent=new File([await (await fetch('/tests/fixtures/silent.mp4')).blob()],'silent.mp4');
                  await adapter.convertCandidate(silent,{mediabunny:m,registerMp3Encoder});
                } catch(e) {noAudio=e?.message;}
                if(noAudio!=='audio')throw Error('No-audio case: '+noAudio);
                checks.push({name:'silent.mp4',status:'PASS',error:noAudio});

                // Real encoder lifecycle: cancel after initialization, when the
                // conversion stage begins. Count native worker terminations.
                const NativeWorker=window.Worker;
                let workersCreated=0, workersTerminated=0, started=false, cancelError=null;
                window.Worker=class extends NativeWorker {
                  constructor(...args){super(...args);workersCreated++;}
                  terminate(){workersTerminated++;return super.terminate();}
                };
                try {
                  const controller=new AbortController();
                  const tone=new File([await (await fetch('/tests/fixtures/tone.m4a')).blob()],'tone.m4a');
                  try {
                    await adapter.convertCandidate(tone,{
                      mediabunny:m,registerMp3Encoder,signal:controller.signal,
                      onStage: stage=>{if(stage==='converting'){started=true;controller.abort();}},
                    });
                  } catch(e) {cancelError=e?.name;}
                  if(!started||cancelError!=='AbortError')
                    throw Error('Cancel stage failed: '+JSON.stringify({started,cancelError}));
                  for(let n=0;n<100&&workersTerminated<workersCreated;n++)
                    await new Promise(ok=>setTimeout(ok,20));
                  if(workersCreated===0||workersTerminated!==workersCreated)
                    throw Error('Worker cleanup failed: '+JSON.stringify({workersCreated,workersTerminated}));
                  checks.push({name:'abort-at-conversion-stage',status:'PASS',workersCreated,workersTerminated});
                } finally {
                  window.Worker=NativeWorker;
                }
              }
              return {records,checks,userAgent:navigator.userAgent};
            }''')
            result['browser'] = browser.version
            result['source'] = {'core_module': CORE_MODULE, 'encoder_module': ENCODER_MODULE, 'candidate_adapter': CANDIDATE_ADAPTER}
            result['elapsed_seconds'] = round(time.monotonic()-start, 2)
            result['requests'] = requests
            assert all((r['url'].startswith(origin+'/') or r['url'].startswith('blob:'+origin+'/')) and r['method']=='GET' and r['body'] is None for r in requests), requests
            (OUT/'smoke.json').write_text(json.dumps(result, indent=2)+'\n')
            print(json.dumps({k:v for k,v in result.items() if k!='requests'}, indent=2))
            browser.close()
            assert len(result['records']) == 7 and all(r['status']=='PASS' for r in result['records']), result['records']
    finally: server.shutdown(); server.server_close()

if __name__ == '__main__': main()
