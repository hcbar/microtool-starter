import {readFileSync} from 'node:fs';
import {readConfig, checkConfig} from './check.mjs';
const p=readConfig(); checkConfig(p);
const w=JSON.parse(readFileSync('wrangler.preview.jsonc','utf8'));
const prod=JSON.parse(readFileSync('wrangler.production.jsonc','utf8'));
if(w.name!==p.slug+'-preview' || prod.name!==p.slug || w.name===prod.name)throw new Error('Preview/production destination collision');
if(w.observability?.enabled!==false || prod.observability?.enabled!==false)throw new Error('Unexpected observability configuration');
if(w.assets?.directory!=='./dist' || w.assets?.run_worker_first?.some(x=>x!=='/api/*'))throw new Error('Unexpected asset routes');
for(const path of ['dist/index.html','dist/pt/index.html','dist/es/index.html']){
 const html=readFileSync(path,'utf8');
 if(!html.includes('noindex,nofollow'))throw new Error('Preview exposes indexable HTML');
}
if(!readFileSync('dist/robots.txt','utf8').includes('Disallow: /'))throw new Error('Preview robots allow indexing');
console.log(`Isolated preview preflight OK: ${w.name} != ${prod.name}; no deployment performed`);
