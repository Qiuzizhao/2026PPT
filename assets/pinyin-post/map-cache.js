/* HTTPS/localhost使用持久图片缓存；file://与旧策略环境静默降级。 */
(function(){
 if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
 var script=document.currentScript;
 var worker=new URL('../../pinyin-map-sw.js',script.src).href;
 window.__pinyinMapCacheReady=navigator.serviceWorker.register(worker).then(function(){
  return navigator.serviceWorker.ready;
 }).then(function(registration){
  function remember(){
   var urls=performance.getEntriesByType('resource').map(function(entry){return entry.name;}).filter(function(url){return url.indexOf('/assets/pinyin-post/')!==-1&&/\.webp$/.test(url);});
   if(registration.active)registration.active.postMessage({type:'remember-pinyin-maps',urls:urls});
  }
  remember();
  if(document.readyState!=='complete')window.addEventListener('load',remember,{once:true});
  return true;
 }).catch(function(){return false;});
})();
