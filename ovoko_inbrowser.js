// ovoko_inbrowser.js — bootstrap in-browser: fetch map+silnik z GitHub raw, czyta IDB, silnik, apply.
// NIE publikuje (Wystaw klikasz sam). Uzycie na stronie marketplace_list_form.php:
//   await ovoko('plan')    -> czyta IDB + silnik, buduje window._APPLY, drukuje podsumowanie + flagi do decyzji
//   (przejrzyj flagi)      -> ewentualne korekty recznie w window._APPLY
//   await ovoko('apply')   -> zapis IDB (fill/uncheck). Potem RELOAD (F5) + await ovoko('verify')
//   await ovoko('verify')  -> statystyki po reloadzie (car/cat/filler)
window.OVOKO_RAW='https://raw.githubusercontent.com/jarinwz-spec/ovoko-toolkit/main/';
window.OVOKO_UNSHIP_CATS=['1097','1996','934','1322','1093'];
(function(){
var NL=String.fromCharCode(10);
function fetchText(f){return fetch(window.OVOKO_RAW+f,{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('fetch '+f+' '+r.status);return r.text();});}
function loadMaps(acct){
  if(window._MAPS&&window._MAPS._acct===acct)return Promise.resolve(window._MAPS);
  var mapFile=acct==='bielsko'?'bielsko_car_models_map_2026-05-29.json':'jaworze_car_models_map_2026-05-29.json';
  var pre=window.OvokoEngine?Promise.resolve():fetchText('ovoko_engine.js').then(function(t){(0,eval)(t);});
  return pre.then(function(){
    return Promise.all([fetchText(mapFile),fetchText('ovoko_car_models_catalog_20260529.csv'),fetchText('ovoko_categories.json'),fetchText('ovoko_mapa_kategorii.json')]);
  }).then(function(a){
    var eng=window.OvokoEngine.build({accountMapJson:a[0],catalogCsv:a[1],categoriesJson:a[2],mapaKategoriiJson:a[3]});
    eng._acct=acct;window._MAPS=eng;return eng;
  });
}
function extractOE(title){
  var m=(String(title).match(/[A-Z0-9][A-Z0-9-]{4,}/gi)||[]).filter(function(x){var y=x.replace(/-/g,'');return (/\d/.test(x)&&/[A-Z]/i.test(y))||/^\d{6,}$/.test(y);});
  m=m.filter(function(x){return !/^(19|20)\d{2}$/.test(x)&&!/^\d{1,2}-\d{1,2}$/.test(x)&&!/^R\d{2}$/i.test(x);});
  return m.length?m[m.length-1]:'';
}
function unorm(s){return String(s).toUpperCase().replace(/\u0141/g,'L').replace(/\u00d3/g,'O').replace(/\u0104/g,'A').replace(/\u0118/g,'E').replace(/\u015a/g,'S').replace(/[\u017b\u0179]/g,'Z').replace(/\u0106/g,'C').replace(/\u0143/g,'N');}
function isUnshipTitle(t){var x=' '+unorm(t)+' ';return /PODSUFITKA|POSZYCIE DACHU| DACH |CWIARTKA|PODLUZNICA|FARTUCH|SZYBA CZOLOWA|SZYBA PRZEDNIA|SZYBA KAROSERYJNA/.test(x);}
function openIDB(){return new Promise(function(res,rej){var q=indexedDB.open('FormItems');q.onsuccess=function(){res(q.result);};q.onerror=function(){rej('open FormItems');};});}
function readItems(db,LID){return new Promise(function(res,rej){var st=db.transaction('items','readonly').objectStore('items');var g=st.getAll();g.onsuccess=function(){res(g.result.filter(function(it){return it.listingId===LID;}));};g.onerror=function(){rej('getAll');};});}
function doApply(LID){
  var plan=window._APPLY||[];var byUid={};plan.forEach(function(p){byUid[p.uniqueId]=p;});
  return openIDB().then(function(db){return new Promise(function(res){
    var tx=db.transaction('items','readwrite');var st=tx.objectStore('items');var done=0,unch=0,err=[];
    Object.keys(byUid).forEach(function(uid){var p=byUid[uid];var g=st.get(uid);
      g.onsuccess=function(){var it=g.result;if(!it){err.push('no '+uid);return;}
        if(p.action==='uncheck'){it.checked=false;st.put(it);unch++;return;}
        var ck=p.ck||Object.keys(it.siteItems)[0];var si=it.siteItems[ck];
        if(p.car_id){if(!si.marketplaceParams.car_id)si.marketplaceParams.car_id={value:''};si.marketplaceParams.car_id.value=String(p.car_id);}
        if(p.firstCode!=null){if(!si.marketplaceParams.manufacturer_code)si.marketplaceParams.manufacturer_code={value:''};si.marketplaceParams.manufacturer_code.value=String(p.firstCode);}
        if(!si.marketplaceParams.visible_code)si.marketplaceParams.visible_code={value:''};si.marketplaceParams.visible_code.value='';
        if(p.position!=null&&p.position!==''){if(!si.categoryParams.position)si.categoryParams.position={value:''};si.categoryParams.position.value=String(p.position);}
        if(p.category&&p.category.id){si.mainFields.category_id.value={id:String(p.category.id),name:p.category.name,path:p.category.path};}
        st.put(it);done++;};
      g.onerror=function(){err.push('geterr '+uid);};});
    tx.oncomplete=function(){db.close();window._WRITE={status:'DONE',done:done,unchecked:unch,errs:err};res('APPLY DONE: fill='+done+' uncheck='+unch+' err='+err.length+(err.length?' '+err.join(';'):'')+NL+'>> RELOAD strone (F5), potem: await ovoko(\'verify\')');};
    tx.onerror=function(e){db.close();res('TXERR '+String(e.target.error));};
    tx.onabort=function(e){db.close();res('ABORT '+String(e.target.error));};
  });});
}
window.ovoko=function(mode){
  mode=mode||'plan';
  var U=new URL(location.href),LID=U.searchParams.get('listing_id'),ACC=U.searchParams.get('account_id');
  var acct=ACC==='45672'?'bielsko':(ACC==='45690'?'jaworze':'jaworze');
  if(mode==='apply')return doApply(LID);
  if(mode==='verify')return openIDB().then(function(db){return readItems(db,LID).then(function(items){db.close();
    var checked=items.filter(function(it){return it.checked;});var car=0,cat=0,noCar=[];
    checked.forEach(function(it){var ck=Object.keys(it.siteItems)[0];var si=it.siteItems[ck];var mp=si.marketplaceParams||{},mf=si.mainFields||{};
      if(mp.car_id&&mp.car_id.value)car++;else noCar.push(it.uniqueId.split('_')[1]);
      if(mf.category_id&&mf.category_id.value&&mf.category_id.value.id)cat++;});
    return 'VERIFY '+LID+' ('+acct+'): total='+items.length+' checked='+checked.length+' car='+car+'/'+checked.length+' cat='+cat+'/'+checked.length+(noCar.length?' BEZ_AUTA['+noCar.join(',')+']':' filler=0');
  });});
  return loadMaps(acct).then(function(eng){return openIDB().then(function(db){return readItems(db,LID).then(function(items){db.close();
    var byUid={};
    var engItems=items.map(function(it){var ck=Object.keys(it.siteItems||{})[0];var si=(it.siteItems||{})[ck]||{};var mp=si.marketplaceParams||{},mf=si.mainFields||{};
      var title=(mf.title&&mf.title.value)||'';var fieldMc=(mp.manufacturer_code&&mp.manufacturer_code.value)||'';
      var oe=extractOE(title);var mc=(oe&&!/\d/.test(fieldMc))?oe:(/\d/.test(fieldMc)?fieldMc:(oe||fieldMc));
      var cat=mf.category_id&&mf.category_id.value;var o={uid:it.uniqueId,ck:ck,title:title,mc:mc,catId:cat&&cat.id!=null?String(cat.id):'',checked:it.checked};byUid[it.uniqueId]=o;return o;});
    var r=eng.run(engItems);
    var fillerId=String(eng.M['1']||'');
    window._APPLY=r.plan.map(function(p){var src=byUid[p.uid];
      var unship=(p.category&&window.OVOKO_UNSHIP_CATS.indexOf(String(p.category.id))>=0)||isUnshipTitle(src.title);
      var noCarNoNum=(!p.car_id||p.car_id===fillerId)&&!/\d/.test(p.firstCode||'');
      var act=(unship||noCarNoNum)?'uncheck':'fill';
      return {uniqueId:p.uid,ck:src.ck,action:act,car_id:p.car_id,firstCode:(/\d/.test(p.firstCode||'')?p.firstCode:null),position:p.position,category:p.category,title:src.title};});
    window._PLANRES=r;
    var show=r.flags.filter(function(f){
      if(/\[CHECK-GEN\]/.test(f)&&/nowsze:\s*$/.test(f))return false;
      if(/\[CHECK\] (tytu\u0142 >75|brak numeru w tytule|numer podejrzany|position PUSTE|wiele numer)/.test(f))return false;
      if(/^\[INFO\]/.test(f))return false;
      return true;});
    var cnt={};r.plan.forEach(function(p){var k=p.car_id||'-';cnt[k]=(cnt[k]||0)+1;});
    var top=Object.keys(cnt).map(function(k){return [k,cnt[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,6);
    var unch=window._APPLY.filter(function(a){return a.action==='uncheck';});
    var out='PLAN '+LID+' ('+acct+'): '+r.plan.length+' poz. | car='+r.plan.filter(function(p){return p.car_id;}).length+'/'+r.plan.length+' | noweKat='+r.newCategories.length+' | UNCHECK='+unch.length+(unch.length?' ['+unch.map(function(u){return u.uniqueId.split('_')[1];}).join(',')+']':'');
    out+=NL+'top car: '+top.map(function(t){return 'car'+t[0]+'x'+t[1];}).join(' ');
    out+=NL+'FLAGI DO DECYZJI ('+show.length+'/'+r.flags.length+'):'+NL+(show.length?show.map(function(f){return '  ! '+f;}).join(NL):'  (brak)');
    out+=NL+'>> przejrzyj; korekty: window._APPLY[i].car_id/category. Potem: await ovoko(\'apply\')';
    return out;
  });});});
};
console.log('%covoko-toolkit gotowy','color:#0a0;font-weight:bold');
console.log('await ovoko(\'plan\')  ->  (przejrzyj flagi)  ->  await ovoko(\'apply\')  ->  F5  ->  await ovoko(\'verify\')');
})();
