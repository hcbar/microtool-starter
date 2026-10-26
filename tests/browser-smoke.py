"""Real HTTP Chromium tests. Synthetic own fixtures; no remote media/services.
Run: Python 3.12 + locked requirements + playwright install --with-deps chromium.
Outputs measured results/screenshots to test-results/ for the candidate artifact.
"""
import json, os, socket, subprocess, time, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HOST='http://127.0.0.1:4173'
OUT=ROOT/'test-results'

class Resources:
    """Linux Chromium process-tree aggregate RSS (shared pages double counted)."""
    def __init__(self): self.peak=0; self.phase_peak=0; self.cpu={}; self.running=True; self.thread=threading.Thread(target=self.sample,daemon=True)
    def sample(self):
        while self.running:
            rss=0
            for proc in Path('/proc').glob('[0-9]*'):
                try:
                    if b'ms-playwright/chrom' not in (proc/'cmdline').read_bytes(): continue
                    stat=(proc/'stat').read_text().split(') ',1)[1].split()
                    rss+=int(stat[21])*os.sysconf('SC_PAGE_SIZE')
                    self.cpu[str(proc)]=max(self.cpu.get(str(proc),0),(int(stat[11])+int(stat[12]))/os.sysconf('SC_CLK_TCK'))
                except (OSError,ValueError,IndexError): pass
            self.peak=max(self.peak,rss);self.phase_peak=max(self.phase_peak,rss);time.sleep(.05)
    def phase_start(self):
        self.phase_peak=0;self.phase_cpu=sum(self.cpu.values())
    def phase_end(self):
        return {'peak_aggregate_rss_MiB':round(self.phase_peak/1024**2,1),'cpu_seconds':round(sum(self.cpu.values())-self.phase_cpu,2)}
    def start(self): self.thread.start()
    def stop(self):
        self.running=False;self.thread.join()
        return {'peak_aggregate_rss_MiB':round(self.peak/1024**2,1),'aggregate_cpu_seconds':round(sum(self.cpu.values()),2)}

def wait_port():
    for _ in range(100):
        try:
            with socket.create_connection(('127.0.0.1',4173),timeout=.1): return
        except OSError: time.sleep(.1)
    raise RuntimeError('preview not started')

def choose(page,name,buffer=None):
    if buffer is None: page.locator('#file').set_input_files(ROOT/'tests/fixtures'/name)
    else: page.locator('#file').set_input_files({'name':name,'mimeType':'application/octet-stream','buffer':buffer})

def convert(page):
    start=time.monotonic();page.locator('[type=submit]').click()
    page.wait_for_function("() => !document.querySelector('[type=submit]').disabled",timeout=125000)
    assert page.locator('#download').is_visible(),page.locator('#status').inner_text()
    with page.expect_download() as info: page.locator('#download').click()
    assert info.value.suggested_filename.endswith('.mp3')
    data=Path(info.value.path()).read_bytes()
    assert len(data)>100 and data[:4]!=b'OggS' and data[4:8]!=b'ftyp'
    decoded=page.evaluate('''async data => {
      const type=document.querySelector('#download').type;const bytes=new Uint8Array(data).buffer;
      const ac=new AudioContext();const a=await ac.decodeAudioData(bytes);await ac.close();
      return {type,duration:a.duration,channels:a.numberOfChannels};
    }''',list(data))
    assert decoded['type']=='audio/mpeg' and abs(decoded['duration']-2)<.15,decoded
    return {'ms':round((time.monotonic()-start)*1000),'bytes':len(data),**decoded}

def main():
    OUT.mkdir(exist_ok=True)
    records=[];requests=[];errors=[]
    server=subprocess.Popen(['node','scripts/dev.mjs'],cwd=ROOT,stdout=subprocess.DEVNULL)
    try:
        wait_port()
        with sync_playwright() as p:
            resources=Resources();resources.start()
            browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH') or None,args=['--no-sandbox'])
            try:
                for mobile in [False,True]:
                    first_request=len(requests)
                    context=browser.new_context(viewport={'width':390 if mobile else 1280,'height':844 if mobile else 900},is_mobile=mobile,has_touch=mobile,accept_downloads=True,reduced_motion='reduce')
                    context.on('request',lambda req: requests.append({'url':req.url,'method':req.method,'body':req.post_data}))
                    page=context.new_page()
                    if mobile: context.new_cdp_session(page).send('Emulation.setCPUThrottlingRate',{'rate':4})
                    page.on('pageerror',lambda e: errors.append(str(e)))
                    page.goto(HOST);page.wait_for_function("() => !document.querySelector('[type=submit]').disabled")
                    assert not any('/assets/core/' in r['url'] for r in requests[first_request:]), 'core must be lazy on first page'
                    # Count real worker termination, including cancellation while executing.
                    page.evaluate('''() => {window.__workers=0;window.__terminations=0;window.__revoked=[];
                      const create=URL.createObjectURL;URL.createObjectURL=b=>{window.__outputType=b.type;return create.call(URL,b);};
                      const W=window.Worker;window.Worker=class extends W {constructor(...a){super(...a);window.__workers++;} terminate(){window.__terminations++;return super.terminate();}};
                      const revoke=URL.revokeObjectURL;URL.revokeObjectURL=u=>{window.__revoked.push(u);revoke.call(URL,u);};}''')
                    for name in ['tone.mp4','tone.ogg','tone.opus','tone.m4a','tone-vorbis.ogg']:
                        print('convert',mobile,name,flush=True)
                        choose(page,name);resources.phase_start()
                        record=convert(page)
                        records.append({'mobile_viewport':mobile,'input':name,**record,'resources':resources.phase_end()})
                        assert not page.locator('#preview').is_hidden()
                    assert page.evaluate('window.__workers===window.__terminations')
                    assert page.evaluate('window.__revoked.length')>=4
                    page.screenshot(path=str(OUT/('mobile.png' if mobile else 'desktop.png')),full_page=True)
                    choose(page,'renamed.mp4',(ROOT/'tests/fixtures/tone.ogg').read_bytes());convert(page)
                    # Exercise the duration boundary with synthetic media built by the
                    # same pinned core, then release its generator worker before testing.
                    resources.phase_start()
                    boundary=page.evaluate('''async mobile => {
                      const {FFmpeg}=await import('/assets/ffmpeg/index.js');
                      const ff=new FFmpeg();await ff.load({coreURL:location.origin+'/assets/core/ffmpeg-core.js',wasmURL:location.origin+'/assets/core/ffmpeg-core.wasm'});
                      const files=[];
                      for(const duration of [359.9,361]) {
                        if(await ff.exec(['-f','lavfi','-i',`sine=frequency=440:duration=${duration}:sample_rate=8000`,'-c:a','aac','-b:a','32k',`long${duration}.m4a`])!==0) throw Error('fixture');
                        files.push(new File([await ff.readFile(`long${duration}.m4a`)],`long${duration}.m4a`));
                      }
                      ff.terminate();window.__longFile=files[0];
                      const {convertToMP3}=await import('/assets/audio.js');
                      const start=performance.now();const out=await convertToMP3(files[0],{mobile});
                      const ac=new AudioContext();const decoded=await ac.decodeAudioData(await out.blob.arrayBuffer());await ac.close();
                      let rejected=false;try{await convertToMP3(files[1],{mobile});}catch(e){rejected=e.message==='duration';}
                      return {ms:Math.round(performance.now()-start),bytes:out.blob.size,type:out.blob.type,duration:decoded.duration,rejected};
                    }''',mobile)
                    assert abs(boundary['duration']-359.9)<.2 and boundary['rejected'],boundary
                    records.append({'mobile_viewport':mobile,'input':'synthetic-359.9s.m4a','includes_decode_and_overlong_rejection':True,'resources_include_fixture_generation':True,**boundary,'resources':resources.phase_end()})
                    # Verify multiple files are refused by drop; no navigation or upload.
                    page.evaluate('''() => {const dt=new DataTransfer();for(const n of ['a.mp4','b.ogg'])dt.items.add(new File(['x'],n));document.querySelector('#drop-zone').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));}''')
                    assert page.locator('#status').inner_text()=='One file at a time.'
                    # Invalid bytes with an allowed extension, valid bytes with unsupported
                    # extension, no audio, overlong media, multiple drop and oversize selection.
                    for name,buffer,error in [('fake.mp4',b'not media','Invalid'),('fake.mp4',b'0000ftyptruncated','Invalid'),('tone.wav',(ROOT/'tests/fixtures/tone.ogg').read_bytes(),'Choose a file'),('silent.mp4',None,'No audio')]:
                        choose(page,name,buffer);page.locator('[type=submit]').click()
                        page.wait_for_function("() => !document.querySelector('[type=submit]').disabled",timeout=30000)
                        assert error in page.locator('#status').inner_text(),(name,page.locator('#status').inner_text())
                        assert page.locator('#download').is_hidden()
                    page.evaluate('''mobile => {const f=new File([new Uint8Array((mobile?25:50)*1024**2+1)],'large.mp4');const dt=new DataTransfer();dt.items.add(f);const input=document.querySelector('#file');input.files=dt.files;input.dispatchEvent(new Event('change'));}''',mobile)
                    assert 'limit' in page.locator('#status').inner_text()
                    # Cancel during worker execution, then replace while another job runs.
                    page.evaluate("() => {const dt=new DataTransfer();dt.items.add(window.__longFile);const input=document.querySelector('#file');input.files=dt.files;input.dispatchEvent(new Event('change'));}")
                    page.locator('[type=submit]').click()
                    page.locator('#status').get_by_text('Converting',exact=False).wait_for(timeout=30000)
                    page.locator('#cancel').click()
                    assert page.locator('#status').inner_text()=='Cancelled.'
                    page.wait_for_timeout(300);assert page.locator('#download').is_hidden()
                    choose(page,'tone.opus');page.locator('[type=submit]').click()
                    choose(page,'tone.m4a');page.wait_for_timeout(400)
                    assert page.locator('#download').is_hidden() and page.locator('#status').inner_text()==''
                    convert(page)
                    assert page.evaluate('window.__workers===window.__terminations')
                    context.close()
                for lang,path in [('pt','/pt/'),('es','/es/'),('en','/')]:
                    page=browser.new_page(viewport={'width':390,'height':844})
                    page.goto(HOST+path)
                    assert page.locator('html').get_attribute('lang').startswith(lang)
                    assert page.locator('meta[name=robots]').get_attribute('content')=='noindex,nofollow'
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                    choose(page,'tone.ogg');page.locator('[type=submit]').click()
                    page.locator('#download').wait_for(state='visible',timeout=30000)
                    page.locator('#file').focus();assert page.locator('#file').evaluate('(e)=>e===document.activeElement')
                    page.close()
                # Network failure has a visible error and can recover with a new job.
                page=browser.new_page();page.goto(HOST)
                page.route('**/assets/core/*',lambda route:route.abort())
                choose(page,'tone.mp4');page.locator('[type=submit]').click()
                page.locator('#status').get_by_text('Codec unavailable',exact=False).wait_for(timeout=30000)
                assert page.locator('#download').is_hidden()
                page.unroute('**/assets/core/*');choose(page,'tone.mp4');convert(page);page.close()
                assert not errors,errors
                assert all(r['method']=='GET' and not r['body'] and (r['url'].startswith(HOST+'/') or r['url'].startswith('blob:'+HOST+'/')) for r in requests),requests
            finally:
                browser.close();measure=resources.stop()
            event=json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text()) if os.getenv('GITHUB_EVENT_PATH') else {}
            pr=event.get('pull_request',{})
            provenance={'base_sha':pr.get('base',{}).get('sha'),'head_sha':pr.get('head',{}).get('sha'),'tested_merge_sha':os.getenv('GITHUB_SHA'),'local_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'worktree_dirty':bool(subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True).strip())}
            report={'provenance':provenance,'chromium':browser.version,'conversions':records,'resources':measure,'network':'only same-origin GET static assets and local blob reads; no request bodies','requests':requests}
            (OUT/'browser-evidence.json').write_text(json.dumps(report,indent=2))
            print(json.dumps({k:v for k,v in report.items() if k!='requests'},indent=2))
    finally:
        server.terminate();server.wait(timeout=5)
if __name__=='__main__':main()
