const CACHE="teaching-attendance-v5";
const ASSETS=["./","./index.html","./styles.css","./app.js","./history-by-student.js","./config.js","./manifest.webmanifest"];

self.addEventListener("install",e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener("activate",e=>{
  e.waitUntil((async()=>{
    await self.clients.claim();
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    const clients=await self.clients.matchAll({type:"window"});
    for(const client of clients){
      try{ await client.navigate(client.url); }catch(_){ }
    }
  })());
});

async function injectHistoryScript(response){
  const type=response.headers.get("content-type")||"";
  if(!type.includes("text/html")) return response;
  let html=await response.text();
  if(!html.includes("history-by-student.js")){
    html=html.replace("</body>",'<script src="./history-by-student.js?v=5"></script></body>');
  }
  const headers=new Headers(response.headers);
  headers.delete("content-length");
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}

self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  if(e.request.mode==="navigate"){
    e.respondWith((async()=>{
      try{
        const r=await fetch(e.request,{cache:"no-store"});
        const c=r.clone();
        caches.open(CACHE).then(x=>x.put("./index.html",c)).catch(()=>{});
        return injectHistoryScript(r);
      }catch(_){
        const cached=await caches.match("./index.html")||await caches.match("./");
        return cached?injectHistoryScript(cached):Response.error();
      }
    })());
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{
    const c=r.clone();
    caches.open(CACHE).then(x=>x.put(e.request,c)).catch(()=>{});
    return r;
  }).catch(()=>caches.match(e.request)));
});
