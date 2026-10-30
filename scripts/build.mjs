import {rmSync,mkdirSync,writeFileSync,copyFileSync,cpSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {readConfig,checkConfig} from './check.mjs';
const p=readConfig();checkConfig(p);
const target=process.env.DEPLOY_TARGET||'preview';if(!['preview','production'].includes(target))throw new Error('DEPLOY_TARGET must be preview or production');
const publicIndexable=target==='production'&&p.indexable&&Boolean(p.siteUrl);
const dist=resolve('dist');rmSync(dist,{recursive:true,force:true});mkdirSync(join(dist,'assets'),{recursive:true});
for(const file of ['app.js','audio.js','style.css'])copyFileSync(`src/${file}`,join(dist,'assets',file));
cpSync('node_modules/@ffmpeg/ffmpeg/dist/esm',join(dist,'assets/ffmpeg'),{recursive:true});
cpSync('node_modules/@ffmpeg/core/dist/esm',join(dist,'assets/core'),{recursive:true});
mkdirSync(join(dist,'licenses'),{recursive:true});
cpSync('licenses',join(dist,'licenses'),{recursive:true});
writeFileSync(join(dist,'assets/messages.json'),JSON.stringify(p.content));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const urlFor=lang=>lang==='en'?'/':`/${lang}/`;
const urlBase=p.siteUrl?p.siteUrl.replace(/\/$/,''):null;
for(const lang of p.locales){
  const c=p.content[lang], route=urlFor(lang),dir=lang==='en'?dist:join(dist,lang);mkdirSync(dir,{recursive:true});
  const canonical=urlBase?`${urlBase}${route}`:'';
  const alternates=publicIndexable?p.locales.map(l=>`<link rel="alternate" hreflang="${l==='pt'?'pt-BR':l}" href="${esc(urlBase+urlFor(l))}">`).join(''):'';
  const html=`<!doctype html><html lang="${lang==='pt'?'pt-BR':lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="${publicIndexable?'index,follow':'noindex,nofollow'}"><title>${esc(c.title)} · ${esc(p.brand)}</title><meta name="description" content="${esc(c.description)}">${publicIndexable?`<link rel="canonical" href="${esc(canonical)}">${alternates}<link rel="alternate" hreflang="x-default" href="${esc(urlBase+'/')}">`:''}<link rel="stylesheet" href="/assets/style.css"><script type="module" src="/assets/app.js"></script></head><body><header><nav aria-label="Languages"><span class="brand">${esc(p.brand)}</span><span><a href="/" lang="en">EN</a><a href="/pt/" lang="pt-BR">PT</a><a href="/es/" lang="es">ES</a></span></nav></header><main><h1>${esc(c.hero)}</h1><p class="lead">${esc(c.lead)}</p><section class="panel"><form id="tool-form"><div id="drop-zone" class="field"><label for="file">${esc(c.upload)}</label><input id="file" type="file" accept=".mp4,.m4a,.ogg,.opus" aria-describedby="limits"></div><p id="input-info"></p><p class="format">${esc(c.target)}</p><div class="actions"><button type="submit">${esc(c.action)}</button><button type="button" id="cancel" hidden>${esc(c.cancel)}</button></div><p id="status" role="status" aria-live="polite"></p><progress id="progress" hidden aria-label="${esc(c.status)}"></progress><p id="result" aria-live="polite"></p><audio id="preview" controls hidden aria-label="${esc(c.preview)}"></audio><a id="download" class="download" hidden>${esc(c.download)}</a></form></section><p id="limits" class="note">${esc(c.note)}</p></main><footer><a href="/licenses/NOTICE.txt">FFmpeg · GPL / source</a> · <span>${esc(p.brand)} · ${target==='preview'?'Preview':'Production'}</span></footer></body></html>`;
  writeFileSync(join(dir,'index.html'),html);
}
// Cloudflare Static Assets _headers format. Security defaults do not permit external scripts or connections.
writeFileSync(join(dist,'_headers'),`/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()\n  X-Frame-Options: DENY\n  Content-Security-Policy: default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; media-src 'self' blob:; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'\n`);
writeFileSync(join(dist,'robots.txt'),publicIndexable?'User-agent: *\nAllow: /\nSitemap: '+urlBase+'/sitemap.xml\n':'User-agent: *\nDisallow: /\n');
if(publicIndexable)writeFileSync(join(dist,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+p.locales.map(l=>`<url><loc>${esc(urlBase+urlFor(l))}</loc></url>`).join('')+'</urlset>');
for(const kind of ['preview','production']){
  const data={name:p.slug+(kind==='preview'?'-preview':''),compatibility_date:'2026-10-24',workers_dev:true,preview_urls:false,assets:{directory:'./dist',html_handling:'force-trailing-slash'},observability:{enabled:false}};
  if(p.profile==='backend')Object.assign(data,{main:'./worker/api.mjs',no_bundle:true,assets:{...data.assets,binding:'ASSETS',run_worker_first:['/api/*']}});
  writeFileSync(resolve(`wrangler.${kind}.jsonc`),JSON.stringify(data,null,2)+'\n');
}
console.log(`Built ${p.brand} for ${target}; profile=${p.profile}; indexable=${publicIndexable}`);
