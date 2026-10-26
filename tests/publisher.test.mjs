import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,cpSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('no token-bearing preview publisher exists by default',()=>{
  const yaml=readFileSync('.github/workflows/deploy-preview.yml','utf8');
  assert.doesNotMatch(yaml,/(secrets\.|wrangler deploy|npx.*wrangler|CLOUDFLARE_API_TOKEN)/);
  assert.match(yaml,/no deploy/i);
});

// Operate in an isolated copy: npm run verify must work when production is
// indexable; tests about preview must not read production's dist directory.
test('F2: preview preflight and indexable production validation are independent',()=>{
  const root=mkdtempSync(join(tmpdir(),'microtool-targets-'));
  try {
    for(const item of ['config','scripts','src','worker','licenses'])cpSync(item,join(root,item),{recursive:true});
    cpSync('node_modules',join(root,'node_modules'),{recursive:true});
    const cfg=join(root,'config/product.json');
    const p=JSON.parse(readFileSync(cfg,'utf8'));
    p.siteUrl='https://tools.example.net/';p.indexable=true;
    writeFileSync(cfg,JSON.stringify(p));
    const run=(target,args)=>{
      const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',env:{...process.env,DEPLOY_TARGET:target}});
      assert.equal(r.status,0,`${target} ${args.join(' ')}: ${r.stderr}\n${r.stdout}`);
      return r;
    };
    run('preview',['scripts/build.mjs']);
    run('preview',['scripts/verify-build.mjs']);
    assert.match(readFileSync(join(root,'dist/index.html'),'utf8'),/noindex,nofollow/);
    assert.match(run('preview',['scripts/preview-target-check.mjs']).stdout,/no deployment performed/i);
    run('production',['scripts/build.mjs']);
    run('production',['scripts/verify-build.mjs']);
    const html=readFileSync(join(root,'dist/index.html'),'utf8');
    assert.match(html,/<meta name="robots" content="index,follow">/);
    assert.match(html,/rel="canonical"/);
    assert.match(readFileSync(join(root,'dist/robots.txt'),'utf8'),/Sitemap:/);
    assert.match(readFileSync(join(root,'dist/sitemap.xml'),'utf8'),/https:\/\/tools\.example\.net\//);
  }finally {rmSync(root,{recursive:true,force:true});}
});
