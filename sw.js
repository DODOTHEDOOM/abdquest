// Abd's Quest - Service Worker v3
const CACHE='abdquest-v3';

self.addEventListener('install',()=>{
  console.log('[SW] Installed');
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  console.log('[SW] Activated');
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch',e=>{
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
      if(cs.length>0)return cs[0].focus();
      return clients.openWindow('./AbdQuestV3.html');
    })
  );
});

self.addEventListener('message',e=>{
  if(e.data&&e.data.type==='PING'){
    try{e.ports[0].postMessage({type:'PONG'});}catch{}
  }
});

console.log('[SW] Abd Quest SW ready');
