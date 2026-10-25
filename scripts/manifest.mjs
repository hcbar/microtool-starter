import {createHash} from 'node:crypto';import {readFileSync,readdirSync,writeFileSync,statSync} from 'node:fs';import {join,relative} from 'node:path';
const walk=dir=>readdirSync(dir).flatMap(n=>{const f=join(dir,n);return statSync(f).isDirectory()?walk(f):[f]});
const files=walk('dist').sort().map(f=>({path:relative('dist',f).replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(f)).digest('hex')}));
const data={version:1,commit:process.env.GITHUB_SHA||'local',target:process.env.DEPLOY_TARGET||'preview',files};
writeFileSync('release-manifest.json',JSON.stringify(data,null,2)+'\n');console.log(`Sealed ${files.length} assets (manifest is advisory; deployment must verify same bytes)`);
