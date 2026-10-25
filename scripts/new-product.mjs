// Safe minimal generator: customize product metadata without copying Recorte secrets/workflows.
import {readFileSync,writeFileSync} from 'node:fs';
import {readConfig,checkConfig} from './check.mjs';
const [slug,brand,profile='local',siteUrl='']=process.argv.slice(2);
if(!slug||!brand){console.error('Usage: npm run new:product -- my-slug "My Tool" [local|backend] [https://mydomain.com/]');process.exit(2);}
const p=readConfig();p.slug=slug;p.brand=brand;p.profile=profile;p.siteUrl=siteUrl;p.indexable=false;
checkConfig(p);writeFileSync('config/product.json',JSON.stringify(p,null,2)+'\n');
console.log('Metadata ONLY updated; the example image-compression logic remains in src/. Replace it with your function, UI copy and tests BEFORE deploying. No deploy performed.');
