import {createServer} from 'node:http';import {readFileSync,existsSync,statSync} from 'node:fs';import {resolve,sep,extname} from 'node:path';import {execFileSync} from 'node:child_process';import {readConfig} from './check.mjs';import backend from '../worker/api.mjs';
// Rebuild on each start: never serve a stale dist after configuration or source edits.
execFileSync(process.execPath,['scripts/build.mjs'],{stdio:'inherit',env:{...process.env,DEPLOY_TARGET:'preview'}});
const root=resolve('dist')+sep;const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8','.xml':'application/xml'};
const security={'x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"};
const product=readConfig();
const server=createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,security).end();return;}
  let url;try{url=new URL(req.url,'http://localhost')}catch{res.writeHead(400,security).end();return;}
  let path;try{path=decodeURIComponent(url.pathname)}catch{res.writeHead(400,security).end();return;}
  if(product.profile==='backend' && path.startsWith('/api/')){
    try {
      const response=await backend.fetch(new Request(new URL(req.url,'http://127.0.0.1:4173'),{method:req.method}));
      const headers=Object.fromEntries(response.headers.entries());
      res.writeHead(response.status,{...security,...headers}).end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
    } catch {res.writeHead(500,security).end('Backend preview failed');}
    return;
  }
  if(path==='/pt'||path==='/es'){res.writeHead(308,{...security,location:path+'/'}).end();return;}
  if(path.includes('\\')||path.includes('\0')||path.split('/').includes('..')){res.writeHead(400,security).end();return;}
  const file=resolve('dist',path.replace(/^\//,''),path.endsWith('/')?'index.html':'');
  if(!file.startsWith(root)||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404,security).end('Not found');return;}
  const body=readFileSync(file);res.writeHead(200,{...security,'content-type':mime[extname(file)]||'application/octet-stream','content-length':body.length});res.end(req.method==='HEAD'?undefined:body);
});
const port=Number(process.env.PORT||4173);server.listen(port,'127.0.0.1',()=>console.log(`Local preview http://127.0.0.1:${port}`));
