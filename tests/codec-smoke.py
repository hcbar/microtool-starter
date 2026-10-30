"""Initial codec gate; --generate writes our synthetic fixtures using the pinned WASM.
Run with the dev server on :4173. No native ffmpeg or remote media needed.
"""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox'])
    page = browser.new_page()
    page.goto('http://127.0.0.1:4173')
    result = page.evaluate('''async generate => {
      const {FFmpeg} = await import('/assets/ffmpeg/index.js');
      const ff = new FFmpeg(); const logs = [];
      ff.on('log', ({message}) => logs.push(message));
      await ff.load({coreURL:location.origin+'/assets/core/ffmpeg-core.js',wasmURL:location.origin+'/assets/core/ffmpeg-core.wasm'});
      const results = [];
      for (const name of ['tone.mp4','tone.ogg','tone.opus','tone.m4a','tone-vorbis.ogg','silent.mp4']) {
        if (generate) {
          const args = name==='tone.mp4' ? ['-f','lavfi','-i','sine=frequency=440:duration=2:sample_rate=48000','-f','lavfi','-i','color=c=blue:s=32x32:d=2','-c:a','aac','-c:v','mpeg4','-shortest',name] : name==='silent.mp4' ? ['-f','lavfi','-i','color=c=blue:s=32x32:d=2','-an','-c:v','mpeg4',name] :
            ['-f','lavfi','-i','sine=frequency=440:duration=2:sample_rate=48000','-c:a', /mp4|m4a/.test(name)?'aac':name.includes('vorbis')?'libvorbis':'libopus',name];
          if (await ff.exec(args)!==0) throw Error(logs.join('\\n'));
        } else {
          await ff.writeFile(name,new Uint8Array(await (await fetch('/fixtures/'+name)).arrayBuffer()));
        }
        const data = await ff.readFile(name);
        if (name==='silent.mp4') {results.push({name,fixture:generate?Array.from(data):null});continue;}
        const start = performance.now();
        if (await ff.exec(['-i',name,'-map','0:a:0','-vn','-c:a','libmp3lame','-b:a','128k','out.mp3'])!==0) throw Error(logs.join('\\n'));
        const out = await ff.readFile('out.mp3');
        const ac = new AudioContext(); const decoded = await ac.decodeAudioData(out.buffer.slice(0)); await ac.close();
        results.push({name,bytes:out.length,duration:decoded.duration,ms:performance.now()-start,fixture:generate?Array.from(data):null});
      }
      await ff.exec(['-version']);
      ff.terminate();return {results,logs};
    }''', '--generate' in sys.argv)
    for r in result['results']:
        fixture=r.pop('fixture')
        if fixture is not None: (ROOT/'tests/fixtures'/r['name']).write_bytes(bytes(fixture))
        if 'duration' in r: assert abs(r['duration']-2)<.15, r
    print(json.dumps(result,indent=2))
    browser.close()
