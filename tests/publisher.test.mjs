import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('no token-bearing preview publisher exists by default',()=>{
  const yaml=readFileSync('.github/workflows/deploy-preview.yml','utf8');
  assert.doesNotMatch(yaml,/(secrets\.|wrangler deploy|npx.*wrangler|CLOUDFLARE_API_TOKEN)/);
  assert.match(yaml,/no deploy/i);
});
test('preview preflight disallows indexation and separates product worker',async()=>{
  const {spawnSync}=await import('node:child_process');
  const r=spawnSync(process.execPath,['scripts/preview-target-check.mjs'],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/no deployment performed/i);
});
