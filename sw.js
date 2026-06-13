// Neutralized service worker — unregisters itself and clears caches.
self.addEventListener('install',function(e){self.skipWaiting();});
self.addEventListener('activate',function(e){
  e.waitUntil((async function(){
    try{var ks=await caches.keys();await Promise.all(ks.map(function(k){return caches.delete(k);}));}catch(err){}
    try{await self.registration.unregister();}catch(err){}
    try{var cs=await self.clients.matchAll();cs.forEach(function(c){c.navigate(c.url);});}catch(err){}
  })());
});
// Never intercept fetches — always go to network.
