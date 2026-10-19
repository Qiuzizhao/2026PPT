/* 只缓存拼音地图与角色，不缓存课件HTML；修改图片内容时递增版本。 */
var MAP_CACHE='pinyin-map-images-v1';
var root=new URL('./',self.location.href);
function isMap(url){
 return url.origin===root.origin&&url.pathname.indexOf(root.pathname+'assets/pinyin-post/')===0&&/\.webp$/.test(url.pathname);
}
self.addEventListener('install',function(event){event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',function(event){
 event.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(key){return key.indexOf('pinyin-map-images-')===0&&key!==MAP_CACHE;}).map(function(key){return caches.delete(key);}));}).then(function(){return self.clients.claim();}));
});
function readMap(request){
 return caches.open(MAP_CACHE).then(function(cache){
  return cache.match(request).then(function(hit){
   if(hit)return hit;
   return fetch(request).then(function(response){
    if(!response.ok)return response;
    var copy=response.clone();
    return cache.put(request,copy).catch(function(){}).then(function(){return response;});
   });
  });
 }).catch(function(){return fetch(request);});
}
self.addEventListener('fetch',function(event){
 if(event.request.method==='GET'&&isMap(new URL(event.request.url)))event.respondWith(readMap(event.request));
});
/* 首次安装前已下载的图片也存入持久缓存，使用HTTP缓存避免重复传输。 */
self.addEventListener('message',function(event){
 var data=event.data;
 if(!data||data.type!=='remember-pinyin-maps'||!Array.isArray(data.urls))return;
 event.waitUntil(caches.open(MAP_CACHE).then(function(cache){
  return Promise.all(data.urls.slice(0,31).filter(function(url){try{return isMap(new URL(url));}catch(e){return false;}}).map(function(url){
   return cache.match(url).then(function(hit){if(hit)return;return fetch(url,{cache:'force-cache'}).then(function(response){if(response.ok)return cache.put(url,response);});}).catch(function(){});
  }));
 }).catch(function(){}));
});
