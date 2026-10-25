import {readFileSync,existsSync} from 'node:fs';
import {readConfig,checkConfig} from './check.mjs';
const p=readConfig();checkConfig(p);
const target=process.env.DEPLOY_TARGET||'preview';
for(const lang of p.locales){const path=lang==='en'?'dist/index.html':`dist/${lang}/index.html`;const s=readFileSync(path,'utf8');
  if(!s.includes('<html lang=')||!s.includes(p.content[lang].hero)||!s.includes('/assets/app.js'))throw new Error(`Missing localized page ${lang}`);
  const indexable=target==='production'&&p.indexable;
  if(s.includes('<meta name="robots" content="index,follow">')!==indexable)throw new Error('index state mismatch');
}
const h=readFileSync('dist/_headers','utf8');if(!h.includes("script-src 'self'")||!h.includes("connect-src 'self'"))throw new Error('CSP weakened');
if(!existsSync('dist/robots.txt'))throw new Error('robots missing');
const config=JSON.parse(readFileSync('wrangler.preview.jsonc','utf8'));
if(config.name.endsWith('-preview')===false||config.observability.enabled!==false)throw new Error('unsafe preview config');
console.log('Build verification OK');
