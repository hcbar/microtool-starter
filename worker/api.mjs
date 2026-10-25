// Backend profile only. No generic outbound fetch and no API keys in client code.
const HEADERS={
  'cache-control':'no-store',
  'content-type':'application/json; charset=utf-8',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
};
export default {
  async fetch(request) {
    const url=new URL(request.url);
    if(url.pathname==='/api/health' && request.method==='GET')return new Response(JSON.stringify({ok:true}),{status:200,headers:HEADERS});
    return new Response(JSON.stringify({error:'NOT_FOUND'}),{status:404,headers:HEADERS});
  }
};
