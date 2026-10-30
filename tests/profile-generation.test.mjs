import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,cpSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('fresh backend profile generates isolated Worker endpoints and stays noindex',()=>{
  const root=mkdtempSync(join(tmpdir(),'microtool-profile-'));
  try {
    for(const item of ['config','scripts','src','worker','licenses'])cpSync(item,join(root,item),{recursive:true});
    cpSync('node_modules',join(root,'node_modules'),{recursive:true});
    const cfg=join(root,'config/product.json');
    const p=JSON.parse(readFileSync(cfg,'utf8'));
    p.slug='distinct-tool';p.brand='Distinct Tool';p.profile='backend';
    writeFileSync(cfg,JSON.stringify(p));
    const run=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,encoding:'utf8',env:{...process.env,DEPLOY_TARGET:'preview'}});
    assert.equal(run.status,0,run.stderr);
    const w=JSON.parse(readFileSync(join(root,'wrangler.preview.jsonc'),'utf8'));
    const prod=JSON.parse(readFileSync(join(root,'wrangler.production.jsonc'),'utf8'));
    assert.equal(w.name,'distinct-tool-preview');
    assert.equal(prod.name,'distinct-tool');
    assert.equal(w.main,'./worker/api.mjs');
    assert.deepEqual(w.assets.run_worker_first,['/api/*']);
    assert.match(readFileSync(join(root,'dist/index.html'),'utf8'),/noindex,nofollow/);
  }finally{rmSync(root,{recursive:true,force:true})}
});
