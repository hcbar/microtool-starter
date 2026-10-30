"""Real Chromium ownership/deadline/CSP checks. Loopback, ephemeral encoder only."""
import functools, http.server, json, os, subprocess, threading, time
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HERE = '/experiments/mediabunny/'
WASM = 'a680e507e9d91f1a4dcd6f846b9b94ff1fec7e19ff44e803358c218ddbe446a6'
# Equivalent to app headers, including worker-src self. No blob workers, inline
# scripts, unsafe-eval, remote imports, or extra network permissions are needed.
CSP = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; media-src 'self' blob:; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
    def end_headers(self):
        query = parse_qs(urlsplit(self.path).query)
        policy = CSP
        if 'no-wasm' in query: policy = policy.replace(" 'wasm-unsafe-eval'", '')
        self.send_header('Content-Security-Policy', policy)
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()
    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/isolation':
            self.send_response(200); self.send_header('Content-Type', 'text/html'); self.end_headers()
            self.wfile.write(b'<!doctype html><link rel="icon" href="data:,">')
        elif path == '/csp-check.mjs':
            self.send_response(200); self.send_header('Content-Type', 'text/javascript'); self.end_headers()
            self.wfile.write(b"try{eval('window.evalAllowed=true')}catch(e){window.evalBlocked=e.name==='EvalError'}")
        elif path in [HERE + 'isolated-worker.mjs', HERE + 'pinned-build/encode.worker.js']:
            # Instrument the actual code before execution, in every worker realm.
            # Fault selection exists only in this loopback test server.
            original = (ROOT / path.lstrip('/')).read_text()
            probe = (ROOT / (HERE + 'isolation-fixtures.js').lstrip('/')).read_text()
            if path.endswith('.mjs'): probe = "import './isolation-fixtures.js';\n"
            self.send_response(200); self.send_header('Content-Type', 'text/javascript'); self.end_headers()
            self.wfile.write((probe + original).encode())
        elif path == HERE + 'isolation-fixtures.js':
            # Module location is the importing worker's self.location, including
            # the fault query; no production source is patched or fault-enabled.
            super().do_GET()
        else: super().do_GET()

def main():
    assert CSP in (ROOT / 'dist/_headers').read_text(), 'Harness CSP must equal the application policy'
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    records, probes, errors, requests = [], [], [], []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH') or None, args=['--no-sandbox'])
            page = browser.new_page()
            page.set_default_timeout(15000)
            cdp = browser.new_browser_cdp_session()
            cdp.send('Target.setDiscoverTargets', {'discover': True})
            destroyed = []
            destroyed_at = {}
            def target_destroyed(event):
                destroyed.append(event['targetId'])
                destroyed_at[event['targetId']] = time.monotonic()
            cdp.on('Target.targetDestroyed', target_destroyed)
            page.add_init_script(path=str(ROOT / 'experiments/mediabunny/isolation-fixtures.js'))
            def console(msg):
                if msg.text.startswith('isolation-probe '): probes.append(json.loads(msg.text[len('isolation-probe '):]))
                elif msg.type == 'error': errors.append(msg.text)
            page.on('console', console)
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('request', lambda r: requests.append({'url': r.url, 'method': r.method, 'body': r.post_data}))
            page.goto(origin + '/isolation')
            # Generate only trusted synthetic regression inputs. This legacy
            # fixture generator is separate from the isolated candidate pipeline.
            page.evaluate('''async () => {
              window.files={};
              for(const name of ['tone.mp4','tone.m4a','tone.ogg','tone.opus','tone-vorbis.ogg','silent.mp4'])
                files[name]=new File([await (await fetch('/tests/fixtures/'+name)).blob()],name);
              const {FFmpeg}=await import('/dist/assets/ffmpeg/index.js');const ff=new FFmpeg();
              try {
                await ff.load({coreURL:location.origin+'/dist/assets/core/ffmpeg-core.js',wasmURL:location.origin+'/dist/assets/core/ffmpeg-core.wasm'});
                for(const offset of [0,3]) {
                  const args=['-f','lavfi','-i','color=c=blue:s=32x32:d=5'];
                  if(offset)args.push('-itsoffset',String(offset));
                  args.push('-f','lavfi','-i','sine=frequency=440:duration=2:sample_rate=48000','-map','0:v:0','-map','1:a:0','-c:v','mpeg4','-c:a','aac','-y','p2.mp4');
                  if(await ff.exec(args)!==0)throw Error('fixture');
                  const name='video5-audio2-offset'+offset+'.mp4'; files[name]=new File([await ff.readFile('p2.mp4')],name);
                }
                if(await ff.exec(['-f','lavfi','-i','sine=frequency=440:duration=30:sample_rate=48000','-c:a','aac','-y','long.m4a'])!==0)throw Error('fixture');
                files['long.m4a']=new File([await ff.readFile('long.m4a')],'long.m4a');
              } finally {ff.terminate();}
            }''')
            def workers(): return [t for t in cdp.send('Target.getTargets')['targetInfos'] if t['type'] == 'worker']
            def drain():
                start = time.monotonic()
                while workers() and time.monotonic()-start < .5: page.wait_for_timeout(10)
                assert not workers(), workers()
                return round((time.monotonic()-start)*1000, 1)
            drain()
            # All native target creation/destruction events are independent of
            # controller counters. Also assert a flat tree owned by the page.
            created = []
            cdp.on('Target.targetCreated', lambda e: created.append(e['targetInfo']) if e['targetInfo']['type'] == 'worker' else None)
            names = ['tone.mp4','tone.m4a','tone.ogg','tone.opus','tone-vorbis.ogg','video5-audio2-offset0.mp4','video5-audio2-offset3.mp4']
            # The clean upstream build can leave cold decoder startup slower
            # than a warmed run. Allow 7 s for startup AND the intentional hang,
            # then the same 3 s native stop budget. The hang marker is mandatory.
            cases = [(name,'success',None) for name in names] + [
                ('long.m4a','cancel',None), ('silent.mp4','error',None),
                ('long.m4a','error','codec-error'),
                ('long.m4a','timeout','decoder-hang'), ('long.m4a','timeout','codec-hang'),
                ('long.m4a','timeout','both-hang'), ('long.m4a','cancel-hung','both-hang'),
            ]
            for name, mode, fault in cases:
                before = len(probes); err_before = len(errors); target_before = len(created)
                runner = '''async ({name,mode,fault}) => {
                  const {convertIsolated}=await import('/experiments/mediabunny/isolated.mjs');
                  const controller=new AbortController();window.hangController=controller;let encodedBytes=0;
                  const begin=performance.now();let stopRequestedMs;const timeoutMs=10000;
                  try {
                    const query=fault?'?fault='+fault:'';
                    const result=await convertIsolated(files[name],{
                      signal:controller.signal,timeoutMs,
                      workerURL:new URL('/experiments/mediabunny/isolated-worker.mjs'+query,location.href),
                      encoderURL:new URL('/experiments/mediabunny/pinned-build/encode.worker.js'+query,location.href),
                      onStage:(stage,detail)=>{
                        if(stage==='stopping')stopRequestedMs=performance.now()-begin;
                        if(stage==='encoding') {
                          encodedBytes+=detail.bytes;
                          if(mode==='cancel')controller.abort();
                        }
                      },
                    });
                    const ac=new AudioContext();
                    const decoded=await ac.decodeAudioData(await result.blob.arrayBuffer());await ac.close();
                    let energy=0;for(const sample of decoded.getChannelData(0))energy+=sample*sample;
                    return {ok:true,ms:performance.now()-begin,encodedBytes,bytes:result.blob.size,type:result.blob.type,duration:decoded.duration,rms:Math.sqrt(energy/decoded.length)};
                  } catch(e) {return {ok:false,error:e.name,message:e.message,ms:performance.now()-begin,stopRequestedMs,encodedBytes,timeoutMs};}

                }'''
                native_started = time.monotonic()
                args = {'name': name, 'mode': mode, 'fault': fault}
                if mode == 'cancel-hung':
                    page.evaluate('args => {window.hungRun=(' + runner + ')(args);}', args)
                    wait_start = time.monotonic()
                    while len([e for e in probes[before:] if e['event']=='hang']) < 2 and time.monotonic()-wait_start < 6:
                        page.wait_for_timeout(10)
                    assert {e['where'] for e in probes[before:] if e['event']=='hang'}=={'codec','conversion'}, probes[before:]
                    page.evaluate('window.hangController.abort()')
                    result = page.evaluate('window.hungRun')
                else: result = page.evaluate(runner, args)
                active_at_settlement = workers()
                if mode in ['timeout','cancel-hung'] or fault=='codec-error':
                    assert not active_at_settlement, active_at_settlement
                teardown_ms = drain()
                observed = probes[before:]; targets = created[target_before:]
                assert all(t['targetId'] in destroyed for t in targets), (targets, destroyed)
                assert all(t.get('parentId') not in {w['targetId'] for w in targets} for t in targets), targets
                assert not [e for e in observed if e['event'] in ['url-created','url-revoked','csp']], observed
                assert sum(e['event']=='page-worker-created' for e in observed)==len(targets), observed
                if fault != 'codec-error': assert errors[err_before:] == [], errors[err_before:]
                else: assert all('controlled-codec-error' in e for e in errors[err_before:]), errors[err_before:]
                if mode == 'success':
                    assert result['ok'] and result['type']=='audio/mpeg' and abs(result['duration']-2)<.15 and result['rms']>.01, result
                    assert len(targets)==2 and result['encodedBytes']>0, (targets,result)
                    assert sum(e['event']=='decoder-created' for e in observed)==sum(e['event']=='decoder-closed' for e in observed)>0, observed
                elif mode.startswith('cancel'):
                    assert not result['ok'] and result['error']=='AbortError' and result['encodedBytes']>0, result
                elif mode == 'timeout':
                    assert not result['ok'] and result['message']=='timeout', result
                    assert 6950 <= result['stopRequestedMs'] <= 8000 and 9950 <= result['ms'] <= 11000, result
                elif fault == 'codec-error':
                    assert not result['ok'] and 'controlled-codec-error' in result['message'] and result['encodedBytes']>0, result
                else: assert not result['ok'] and result['message']=='audio', result
                if fault and fault.endswith('hang'):
                    expected = {'decoder'} if fault=='decoder-hang' else {'codec'} if fault=='codec-hang' else {'codec','conversion'}
                    assert {e['where'] for e in observed if e['event']=='hang'}==expected, (result, observed)
                wasm = [e['sha256'] for e in observed if e['event']=='wasm' and e['scope'].endswith('encode.worker.js')]
                if mode=='success' or result['encodedBytes']>0: assert wasm==[WASM], wasm
                records.append({'name':name,'mode':mode,'fault':fault,'status':'PASS',**result,'nativeTargetsCreated':len(targets),'nativeTargetsDestroyed':len(targets),'nativeDestructionMs':round((max(destroyed_at[t['targetId']] for t in targets)-native_started)*1000,1),'teardown_ms':teardown_ms,'activeAtSettlement':len(active_at_settlement),'probes':observed})
            assert not errors or all('controlled-codec-error' in error for error in errors), errors
            # Negative controls prove that the browser enforces the CSP and that
            # WASM's narrow permission is necessary. These errors are expected.
            before = len(probes)
            page.evaluate('''async () => {
              const {convertIsolated}=await import('/experiments/mediabunny/isolated.mjs');
              try {await convertIsolated(files['tone.m4a'],{encoderURL:new URL('/experiments/mediabunny/pinned-build/encode.worker.js?no-wasm=1',location.href),timeoutMs:6000});throw Error('WASM unexpectedly allowed');}
              catch(e) {if(!/WebAssembly|unsafe-eval|wasm/i.test(e.message))throw e;}
              const blob=URL.createObjectURL(new Blob(['postMessage(1)'],{type:'text/javascript'}));
              try {const w=new Worker(blob);await new Promise((ok,fail)=>{w.onerror=e=>{e.preventDefault();w.terminate();ok();};w.onmessage=()=>fail(Error('blob worker allowed'));});}
              finally {URL.revokeObjectURL(blob);}
              await import('/csp-check.mjs');
              const script=document.createElement('script');script.textContent='window.inlineAllowed=true';document.head.append(script);
            }''')
            drain(); page.wait_for_timeout(100)
            negative = probes[before:]
            assert any(e['event']=='csp' and e['directive']=='worker-src' for e in negative), negative
            assert any(e['event']=='csp' and e['directive']=='script-src-elem' for e in negative), negative
            leases={e['url'] for e in negative if e['event']=='url-created'}
            assert leases=={e['url'] for e in negative if e['event']=='url-revoked'}, negative
            assert page.evaluate('window.inlineAllowed === undefined && window.evalBlocked === true && window.evalAllowed === undefined')
            assert any(e['event']=='csp' and e.get('blocked')=='eval' for e in negative), negative
            assert all(r['url'].startswith(origin+'/') and r['method']=='GET' and r['body'] is None for r in requests), requests
            provenance = {
                'local_commit': subprocess.check_output(['git','rev-parse','HEAD'], cwd=ROOT, text=True).strip(),
                'github_sha': os.getenv('GITHUB_SHA'),
                'worktree_dirty': bool(subprocess.check_output(['git','status','--porcelain'], cwd=ROOT, text=True).strip()),
            }
            if os.getenv('GITHUB_ACTIONS') == 'true': assert not provenance['worktree_dirty'], provenance
            report={'provenance':provenance,'browser':browser.version,'csp':CSP,'records':records,'negativeCspControls':negative,'activeWorkerTargets':workers(),'requests':requests}
            out=ROOT/'test-results/mediabunny/isolation.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2)+'\n')
            print(json.dumps({k:v for k,v in report.items() if k!='requests'},indent=2))
            browser.close()
    finally: server.shutdown(); server.server_close()

if __name__ == '__main__': main()
