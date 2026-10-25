import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function readConfig(root=process.cwd()) { return JSON.parse(readFileSync(resolve(root,'config/product.json'),'utf8')); }
export function checkConfig(p) {
  if(!/^[a-z][a-z0-9-]{2,49}$/.test(p.slug) || p.slug.endsWith('-')) throw new Error('Invalid slug');
  if(!['local','backend'].includes(p.profile)) throw new Error('Invalid profile');
  if(typeof p.brand!=='string'||p.brand.length>90||p.brand.length<2) throw new Error('Invalid brand');
  if(p.defaultLocale!=='en'||JSON.stringify(p.locales)!==JSON.stringify(['en','pt','es'])) throw new Error('Localizations must be en, pt, es');
  for(const lang of p.locales)for(const k of ['title','description','hero','lead','upload','target','action','download','note','error','status']) {
    if(typeof p.content?.[lang]?.[k]!=='string'||p.content[lang][k].length<2) throw new Error(`Missing content ${lang}.${k}`);
  }
  if(typeof p.indexable!=='boolean')throw new Error('Missing indexable');
  if(p.siteUrl){const u=new URL(p.siteUrl);if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash||u.hostname==='example.com')throw new Error('siteUrl must be the production HTTPS origin ending /');}
  if(p.indexable&&!p.siteUrl)throw new Error('Indexing requires real siteUrl');
  if(p.monetization?.policy!=='responsible')throw new Error('Unapproved monetization policy');
  for(const x of ['adsEnabled','analyticsEnabled','premiumEnabled'])if(typeof p.monetization[x]!=='boolean')throw new Error('Missing monetization flag '+x);
  if(p.monetization.adsEnabled||p.monetization.analyticsEnabled||p.monetization.premiumEnabled)throw new Error('No integration implemented: add separate audited implementation and update checks first');
  return true;
}
if(process.argv[1] && import.meta.url===new URL(`file://${resolve(process.argv[1])}`).href) {
  checkConfig(readConfig());console.log('Product configuration and default safety gates OK');
}
