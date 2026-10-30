import test from 'node:test';import assert from 'node:assert/strict';import {existsSync,readFileSync} from 'node:fs';
test('pages are prerendered in three languages',()=>{for(const s of ['dist/index.html','dist/pt/index.html','dist/es/index.html'])assert.ok(existsSync(s),s)});
test('default preview is not indexable',()=>{if((process.env.DEPLOY_TARGET||'preview')==='preview'){assert.match(readFileSync('dist/index.html','utf8'),/noindex,nofollow/);assert.match(readFileSync('dist/robots.txt','utf8'),/Disallow: \/(?:\n|$)/)}});
test('safety headers and SEO are server-rendered',()=>{const h=readFileSync('dist/_headers','utf8');assert.match(h,/Content-Security-Policy:/);assert.match(h,/frame-ancestors 'none'/);const doc=readFileSync('dist/index.html','utf8');assert.match(doc,/<meta name="description"/);assert.doesNotMatch(doc,/<script(?![^>]*src=)[^>]*>/)});
test('codec assets are self hosted and CSP permits WASM without JS eval',()=>{
  const h=readFileSync('dist/_headers','utf8');
  assert.match(h,/script-src 'self' 'wasm-unsafe-eval'/);assert.match(h,/worker-src 'self'/);
  assert.match(h,/connect-src 'self';/);assert.doesNotMatch(h,/'unsafe-eval'|'unsafe-inline'|https:/);
  for(const f of ['assets/ffmpeg/worker.js','assets/core/ffmpeg-core.wasm','licenses/NOTICE.txt'])assert.ok(existsSync('dist/'+f));
  assert.match(readFileSync('dist/licenses/NOTICE.txt','utf8'),/GPL-2.0-or-later/);
});
