// ovoko_engine.js — AUTO z ovoko_fullcheck.js (NIE EDYTUJ RECZNIE; edytuj zrodlo + regeneruj)
window.OvokoEngine={build:function(maps){
const M=JSON.parse(maps.accountMapJson).map;
const CAT=String(maps.catalogCsv).split(/\r?\n/).slice(1).filter(Boolean).map(l=>{const p=l.split(',');return {id:p[0],mf:p[1],model:p[2],ys:+p[3]||0,ye:+p[4]||9999};});
const CATBRANDS={}; for(const r of CAT){const u=r.mf.toUpperCase(); if(!CATBRANDS[u])CATBRANDS[u]=r.mf;}
const CATS=JSON.parse(maps.categoriesJson);
function flatCats(o,acc){if(Array.isArray(o)){o.forEach(x=>flatCats(x,acc));return acc;}if(o&&typeof o==='object'){if(o.id&&o.name)acc.push({id:String(o.id),name:o.name,path:o.path||''});for(const k in o)if(typeof o[k]==='object')flatCats(o[k],acc);}return acc;}
const CATFLAT=flatCats(CATS,[]);
function catObj(id){const c=CATFLAT.find(x=>x.id===String(id));return c?{id:c.id,name:c.name,path:c.path}:{id:String(id),name:'',path:''};}
const BRAND={VW:'Volkswagen',VOLKSWAGEN:'Volkswagen',AUDI:'Audi',BMW:'BMW',OPEL:'Opel',FORD:'Ford',PORSCHE:'Porsche',HYUNDAI:'Hyundai',KIA:'KIA',SEAT:'Seat',SKODA:'Skoda',TOYOTA:'Toyota',NISSAN:'Nissan',RENAULT:'Renault',PEUGEOT:'Peugeot',CITROEN:'Citroen',MERCEDES:'Mercedes-Benz',DACIA:'Dacia',FIAT:'Fiat',MAZDA:'Mazda',HONDA:'Honda',SUZUKI:'Suzuki',VOLVO:'Volvo',JEEP:'Jeep',DODGE:'Dodge'};
const ROMAN={I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8};
// normalizacja polskich znaków (KRYTYCZNE: \b nie działa z Ł/Ó/Ą itd.)
function norm(s){return String(s).toUpperCase().replace(/Ł/g,'L').replace(/Ó/g,'O').replace(/Ą/g,'A').replace(/Ę/g,'E').replace(/Ś/g,'S').replace(/[ŻŹ]/g,'Z').replace(/Ć/g,'C').replace(/Ń/g,'N');}
// odwrócone mapy do walidacji car_id
const MAPVALUES=new Set(Object.values(M).map(String));
const CARID2MF={};
for(const oid in M){const row=CAT.find(r=>r.id===oid);if(row)CARID2MF[String(M[oid])]=row.mf;}

// ---- rozdz. 7: firstCode ----
const FC_BL=/^(OEM|OE|OES|ORYG|ORG|OG|GM|MB|NEW|USED|KPL|ZESTAW|SET|LH|RH|INDEX|BOSCH|VALEO|SACHS|TRW|ZF|MANN|MAHLE|FEBI|NGK|DENSO|SKF|LUK|HELLA|LEMFORDER|MEYLE)$/;
const FC_LOC=/^(O\d|U\d{1,2}|VP\d|P[1-9]|N[1-9])$/;
function firstCode(mc){const t=String(mc||'').split(/\s+/).filter(Boolean);
  for(const x of t){const u=x.toUpperCase();if(FC_BL.test(u))continue;if(FC_LOC.test(u))continue;if(!/\d/.test(x))continue;if(x.length<3)continue;return x;}
  return t[0]||'';}

// ---- rozdz. 8: getPos (z tytułu, na ZNORMALIZOWANYM tekście) ----
function getPos(title){const t=' '+norm(title)+' ';
  const L=/\b(LEWA|LEWY|LEWE|LH)\b/.test(t), R=/\b(PRAWA|PRAWY|PRAWE|RH)\b/.test(t);
  const F=/\b(PRZOD|PRZEDNI|PRZEDNIA|PRZEDNIE|FRONT)\b/.test(t), B=/\b(TYL|TYLNY|TYLNA|TYLNE|REAR)\b/.test(t);
  const SET=/\b(KOMPLET|ZESTAW|KPL|SET)\b/.test(t);
  if(L&&F)return '80'; if(R&&F)return '90'; if(L&&B)return '60'; if(R&&B)return '70';
  if(L)return '20'; if(R)return '40'; if(F)return '100'; if(B)return '110';
  if(SET)return '50';
  return '';
}

// ---- rozdz. 11A + mapa: kategoria z tytulu — REGULY Z PLIKU ovoko_mapa_kategorii.json (2026-07-02) ----
// Nowe typy czesci dopisuj w JSON (pierwsza pasujaca regula od gory wygrywa) — NIE w kodzie.
const CATRULES=(JSON.parse(maps.mapaKategoriiJson).rules)||[];
function resolveCat(title){const t=' '+norm(title)+' ';
  const F=/\b(PRZOD|PRZEDNI|PRZEDNIA|PRZEDNIE|FRONT)\b/.test(t), B=/\b(TYL|TYLNY|TYLNA|TYLNE|REAR)\b/.test(t);
  const inc=w=>t.includes(w);
  for(const r of CATRULES){
    if(r.all&&!r.all.every(inc)) continue;
    if(r.any&&!r.any.some(inc)) continue;
    if(r.any2&&!r.any2.some(inc)) continue;
    if(r.none&&r.none.some(inc)) continue;
    if(r.requireSide==='F'&&!F) continue;
    if(r.requireSide==='B'&&!B) continue;
    if(r.catF||r.catB) return B?(r.catB||r.catF):(r.catF||r.catB);
    return r.cat||null;
  }
  return null;
}

// ---- rozdz. 9: car_id (offline) ----
function yearOf(t){let m=t.match(/\b(19|20)\d{2}\b/);if(m)return +m[0];m=t.match(/\b(\d{2})-(\d{2})\b/);if(m){const a=+m[1];return a>=70?1900+a:2000+a;}return 0;}
function yearRange(t){const m=String(t).match(/\b((?:19|20)\d{2})\s*-\s*((?:19|20)\d{2})\b/);if(m)return [+m[1],+m[2]];const m2=String(t).match(/\b(\d{2})\s*-\s*(\d{2})\b/);if(m2){const y1=+m2[1]+(+m2[1]>=70?1900:2000);const y2=+m2[2]+(+m2[2]>=70?1900:2000);return [y1,y2];}const y=yearOf(t);return y?[y,y]:null;}
function toks(t){return norm(t).replace(/[^A-Z0-9 .'-]/g,' ').split(/\s+/).filter(Boolean);}
const STOP=new Set(['LEWA','LEWY','LEWE','PRAWA','PRAWY','PRAWE','PRZOD','TYL','PRZEDNI','PRZEDNIA','PRZEDNIE','TYLNY','TYLNA','TYLNE','LIFT','OEM','OE','SPOILER','DYFUZOR','LISTWA','OSLONA','NAKLADKA','ZDERZAKA','ZDERZAK','BLOTNIKA','BLOTNIK','MASKI','ZAWIAS','DRZWI','PLYTA','PODSZYBIE','PLASTIKOWE','MOCOWANIE','SLIZG','PROGU','KLAPY','BAGAZNIKA','KOMPLET','DOKLADKA','LINE','GTI','SPORT','POD']);
function resolveCar(title){
  const tk=toks(title);
  const brandTok=tk.find(x=>BRAND[x]||CATBRANDS[x])||tk[0];
  const mf=BRAND[brandTok]||CATBRANDS[brandTok]||brandTok;
  const yr=yearOf(title);
  const isLift=/\bLIFT\b/.test(' '+norm(title)+' ');
  const codes=tk.filter(x=>/[A-Z]/.test(x)&&/\d/.test(x)&&x.length<=5&&!/^(19|20)\d{2}$/.test(x));
  const romans=tk.filter(x=>ROMAN[x]);
  const genLetters=tk.filter(x=>x.length===1&&/[A-K]/.test(x)&&!ROMAN[x]); // generacje: Corsa F, Mokka B...
  const nameToks=tk.filter(x=>!/\d/.test(x)&&x.length>=2&&!BRAND[x]&&!ROMAN[x]&&!STOP.has(x));
  const digits=tk.filter(x=>/^\d+$/.test(x)&&!/^(19|20)\d{2}$/.test(x));
  // v4.3: odfiltruj pod-warianty (AMG/ST/C-MAX...) gdy tytul ich nie zawiera — czysci remisy generacji
  const _TRIM=['AMG','ST','RS','GTI','GTD','ABARTH','COUPE','CABRIO','CABRIOLET','C-MAX','CMAX','S-MAX','SMAX','B-MAX','BMAX','CROSS','ALLTRACK','SCOUT'];
  const _ttoks=toks(title).map(x=>x.replace(/-/g,''));
  const _hasTrim=w=>_ttoks.includes(w.replace(/-/g,''));
  const cands=CAT.filter(r=>r.mf.toUpperCase()===mf.toUpperCase()).filter(r=>{
    const mt=r.model.toUpperCase().split(/\s+/).map(x=>x.replace(/-/g,''));
    for(const tr of _TRIM){const trb=tr.replace(/-/g,'');if(mt.includes(trb)&&!_hasTrim(tr))return false;}
    return true;});
  let alts=[];
  for(const r of cands){
    const mu=r.model.toUpperCase(), mt=mu.split(/\s+/);
    let sc=0;
    for(const c of codes){ if(mt.includes(c)){sc+=4;} else if(mu.includes(c)){sc+=2;} else { for(const m2 of mt){ if(m2.length>=2&&/[A-Z]/.test(m2)&&/[0-9]/.test(m2)&&c.startsWith(m2)){sc+=3;break;} } } }
    for(const nm of nameToks){ if(mt.includes(nm)){sc+=3;} }
    for(const g of genLetters){ if(mt.includes(g)){sc+=4;} }  // litera generacji
    for(const rm of romans){ if(mt.includes(rm)){sc+=2;} }
    for(const d of digits){ if(mt.includes(d)){sc+=5;} }
    if(yr){ if(yr>=r.ys-1&&yr<=r.ye+1) sc+=1; else sc-=1; }
    if(sc>0) alts.push({r,sc});
  }
  alts.sort((a,b)=>b.sc-a.sc);
  if(!alts.length) return {car_id:M['1']||null,model:'(zapychacz — brak modelu w tytule)',multifit:false,ambiguous:false,filler:true,alts:[]};
  const bestSc=alts[0].sc;
  let top=alts.filter(a=>a.sc===bestSc);
  let best=top[0].r, multifit=false, genAmbig=false;
  if(top.length>1){
    const wantIX=/\bIX\d/.test(norm(title));
    const baseNames=new Set(top.map(a=>a.r.model.split(/\s+/)[0]));
    if(wantIX){ const ix=top.find(a=>/^IX/i.test(a.r.model)); if(ix)best=ix.r; }
    else if(baseNames.size>1){
      multifit=true;
      top.sort((x, y) => {
        const idxX = norm(title).indexOf(x.r.model.toUpperCase().split(/\s+/)[0]);
        const idxY = norm(title).indexOf(y.r.model.toUpperCase().split(/\s+/)[0]);
        return (idxX === -1 ? 9999 : idxX) - (idxY === -1 ? 9999 : idxY);
      });
      best=top[0].r;
    }
    else { // ta sama nazwa, różne generacje (lata)
      const rn = romans.length?ROMAN[romans[romans.length-1]]:0;
      const sn = alts.filter(a=>a.r.model.split(/\s+/)[0]===best.model.split(/\s+/)[0]).sort((x,y)=>x.r.ys-y.r.ys);
      const range = yearRange(title);
      if(rn && sn[rn-1]){ best=sn[rn-1].r; }                                  // rzymska N → N-ta generacja po latach
      else if(range){ const sc2=top.map(a=>({a,ov:Math.max(0,Math.min(range[1],a.r.ye)-Math.max(range[0],a.r.ys)+1),w:a.r.ye-a.r.ys})).sort((x,y)=>y.ov-x.ov||x.w-y.w); if(sc2[0].ov>0) best=sc2[0].a.r; else genAmbig=true; }
      else genAmbig=true;
    }
  }
  return { car_id: M[best.id]||null, model:`${best.mf} ${best.model} (${best.ys}-${best.ye})`,
           multifit, ambiguous: genAmbig,
           alts: alts.slice(0,3).map(a=>`${M[a.r.id]||'?'}:${a.r.model}(${a.r.ys}-${a.r.ye})sc${a.sc}`) };
}

// ---- rozdz. 27.1 / changelog v4.2: PREFIKS NUMERU OE = SYGNAŁ GENERACJI (override car_id) ----
// Klucz = prefiks firstCode; wartość = ovoko model_id (NIE car_id — działa na obu kontach przez M).
// >1 model dla prefiksu → wybór po nakładce lat z tytułu (yearRange), inaczej pierwszy.
const OEPREFIX=[
  {re:/^95C/i, models:['3718']},        // Porsche Macan II (95C, 2024-)
  {re:/^95B/i, models:['1961','2058']}, // Porsche Macan I (95B): 2014-2018 / 2019-
  {re:/^82A/i, models:['2175']},        // Audi A1 II (82A, 2018-)
  {re:/^8Y/i, models:['2877']},         // Audi A3 IV (8Y, 2020-)
];
function carFromOEPrefix(fc,title){
  const code=String(fc||'').replace(/[^A-Za-z0-9]/g,'');
  for(const rule of OEPREFIX){
    if(!rule.re.test(code)) continue;
    let mid=rule.models[0];
    if(rule.models.length>1){
      const yy=yearOf(title); let best=null,bestS=-1e9;
      for(const m of rule.models){const row=CAT.find(r=>r.id===String(m));if(!row)continue;
        const ye=row.ye||9999;
        const s=yy?((yy>=row.ys&&yy<=ye)?1000:-(Math.min(Math.abs(yy-row.ys),Math.abs(yy-ye)))):0;
        if(s>bestS){bestS=s;best=m;}}
      if(best)mid=best;
    }
    const row=CAT.find(r=>r.id===String(mid));
    if(row&&M[mid])return {car_id:String(M[mid]),model:`${row.mf} ${row.model} (${row.ys}-${row.ye})`,prefix:(code.match(rule.re)||[''])[0]};
  }
  return null;
}

// ---- WALIDACJA (kontrole → flagi [CHECK]) ----
function validate(it,car,catId,pos,fc){
  const f=[]; const T=' '+norm(it.title)+' ';
  // NUMERY / kontaminacja
  if(!fc||fc.replace(/-/g,'').length<5) f.push('numer podejrzany (pusty/krótki): "'+fc+'"');
  const tnums=(it.title.match(/[A-Z0-9][A-Z0-9-]{4,}/gi)||[]).filter(x=>/\d/.test(x)&&/[A-Z]/i.test(x.replace(/-/g,''))||/^\d{6,}$/.test(x.replace(/-/g,'')));
  const tnum=tnums.pop();
  if(tnum&&fc&&tnum.toUpperCase().replace(/-/g,'')!==fc.toUpperCase().replace(/-/g,'')) f.push('rozjazd tytuł↔numer: tytuł="'+tnum+'" pole="'+fc+'"');
  const rawNums=String(it.mc||'').split(/\s+/).filter(x=>/\d/.test(x)&&x.replace(/[^A-Z0-9]/gi,'').length>=5);
  if(rawNums.length>2) f.push('wiele numerów w mc ('+rawNums.length+') — potwierdź główny');
  // TYTUŁ
  if(it.title.length>75) f.push('tytuł >75 znaków ('+it.title.length+')');
  if(!tnum) f.push('brak numeru w tytule');
  // POSITION — musi być ustawione, GDY tytuł wskazuje stronę (czujniki/uniwersalne bez strony → puste OK)
  const hasSide=/\b(LEWA|LEWY|LEWE|PRAWA|PRAWY|PRAWE|PRZOD|PRZEDNI|PRZEDNIA|PRZEDNIE|TYL|TYLNY|TYLNA|TYLNE|FRONT|REAR)\b/.test(T);
  if(!pos&&hasSide) f.push('position PUSTE mimo strony w tytule — sprawdź getPos');
  // SPÓJNOŚĆ przód/tył (kategoria vs tytuł vs position)
  if(catId){const c=catObj(catId);const cF=/front/i.test(c.path),cR=/rear/i.test(c.path);
    const tF=/\b(PRZOD|PRZEDNI|FRONT)\b/.test(T),tB=/\b(TYL|TYLN|REAR)\b/.test(T);
    if(cF&&tB) f.push('SPRZECZNOŚĆ: kat FRONT ('+catId+') ale tytuł TYŁ');
    if(cR&&tF) f.push('SPRZECZNOŚĆ: kat REAR ('+catId+') ale tytuł PRZÓD');
    if(cF&&['60','70','110'].includes(pos)) f.push('position tył ('+pos+') vs kat FRONT');
    if(cR&&['80','90','100'].includes(pos)) f.push('position przód ('+pos+') vs kat REAR');
  }
  // car_id sanity
  if(car.car_id&&!car.filler){
    if(!MAPVALUES.has(String(car.car_id))) f.push('car_id '+car.car_id+' SPOZA mapy konta (wyciek?)');
    const cidMf=CARID2MF[String(car.car_id)];
    const tb=toks(it.title).find(x=>BRAND[x]);
    if(cidMf&&tb&&BRAND[tb]&&cidMf.toUpperCase()!==BRAND[tb].toUpperCase()) f.push('car_id marka='+cidMf+' ≠ tytuł='+BRAND[tb]);
  }
  // v4.3: kod nadwozia z tytulu vs rozwiazany car (dziala nawet bez flagi silnika)
  if(car.car_id&&!car.filler){
    const bodyRe=/^(W\d{3}|C\d{3}|A\d{3}|[EFGU]\d{2}|8[A-Z]\d|NX\d|J\d{2})$/;
    const tCodes=toks(it.title).filter(x=>bodyRe.test(x));
    if(tCodes.length){
      const oid=Object.keys(M).find(k=>String(M[k])===String(car.car_id));
      const row=oid?CAT.find(r=>r.id===oid):null;const modelU=row?row.model.toUpperCase():'';const mfU=row?row.mf.toUpperCase():'';
      for(const code of tCodes){
        const real=CAT.some(r=>r.mf.toUpperCase()===mfU&&r.model.toUpperCase().split(/\s+/).includes(code));
        if(real&&!modelU.split(/\s+/).includes(code)) f.push('KOD NADWOZIA "'+code+'" z tytulu != rozwiazany car ('+modelU+') - sprawdz generacje');
      }
    }
  }
  return f;
}

// ---- MAIN (browser) ----
function run(items){

const plan=[]; const newCats=new Set(); const flags=[];
for(const it of items){
  const fc=firstCode(it.mc);
  const pos=getPos(it.title);
  const car=resolveCar(it.title);
  const oeOv=carFromOEPrefix(fc,it.title);
  if(oeOv){ car.car_id=oeOv.car_id; car.model=oeOv.model; car.multifit=false; car.ambiguous=false; car.filler=false;
    flags.push(`${it.uid} OE-PREFIX ${oeOv.prefix} → wymuszono ${oeOv.model} (car${oeOv.car_id})`); }
  let catId=resolveCat(it.title);
  if(!catId){ catId=it.catId&&String(it.catId)!=='0'?String(it.catId):null; if(!catId)flags.push(`${it.uid} BRAK KATEGORII (reguła nie złapała): "${it.title}"`); }
  if(car.ambiguous) flags.push(`${it.uid} car_id GENERACJA niejasna → ${car.alts.join(' | ')}`);
  else if(car.multifit) flags.push(`${it.uid} MULTI-FIT → wylosowano car${car.car_id} (${car.model}); inne: ${car.alts.join(' | ')}`);
  else if(car.filler) flags.push(`${it.uid} ZAPYCHACZ car${car.car_id} (brak modelu w tytule)`);
  if(/\bLIFT\b/i.test(it.title)&&!car.ambiguous) flags.push(`${it.uid} LIFT — zweryfikuj generację (auto: ${car.model})`);
  // FLAGA v4.6: spadek do NAJSTARSZEJ generacji (kod/rzymska/rok wskazuja nowsza)
  if(!oeOv && car.car_id && !car.filler){
    const _oid=Object.keys(M).find(k=>String(M[k])===String(car.car_id));
    const _row=_oid?CAT.find(r=>r.id===_oid):null;
    if(_row){
      const _base=_row.model.split(' ')[0];
      const _sb=CAT.filter(r=>r.mf.toUpperCase()===_row.mf.toUpperCase()&&r.model.split(' ')[0]===_base);
      if(_sb.length>1){
        const _min=Math.min.apply(null,_sb.map(r=>r.ys||9999));
        if((_row.ys||9999)===_min){
          const _yr=yearOf(it.title);
          const _in=_yr&&_yr>=(_row.ys-1)&&_yr<=(_row.ye+1);
          const _tk=toks(it.title);
          const _rom=_tk.filter(x=>ROMAN[x]);
          const _cod=_tk.filter(x=>/[A-Z]/.test(x)&&/[0-9]/.test(x)&&x.length<=5&&!/^(19|20)[0-9]{2}$/.test(x));
          const _sig=_rom.some(function(rm){return ROMAN[rm]>1;})||_cod.length>0||(_yr&&!_in)||_tk.some(function(x){return x.length===1&&/[A-Z]/.test(x);});
          if(!_in&&_sig){
            const _new=_sb.filter(r=>(r.ys||0)>_row.ys).sort((a,b)=>a.ys-b.ys).map(r=>(M[r.id]||"?")+":"+r.model+"("+r.ys+"-"+r.ye+")");
            flags.push(it.uid+" [CHECK-GEN] car_id SPADL DO NAJSTARSZEJ GENERACJI -> "+car.model+" - ZWERYFIKUJ; nowsze: "+_new.join(" | "));
          }
        }
      }
    }
  }
  const category = catId?catObj(catId):null;
  if(category && String(it.catId)!==catId) newCats.add(catId);
  validate(it,car,catId,pos,fc).forEach(c=>flags.push(`${it.uid} [CHECK] ${c}`));
  plan.push({uid:it.uid,title:it.title,car_id:car.car_id?String(car.car_id):'',model:car.model,position:pos,firstCode:fc,category});
}
// duplikaty numeru w paczce (2 szt. czy błąd?)
const nc={}; plan.forEach(p=>{if(p.firstCode)nc[p.firstCode]=(nc[p.firstCode]||0)+1;});
Object.keys(nc).filter(n=>nc[n]>1).forEach(n=>flags.push(`[INFO] numer ${n} ×${nc[n]} w paczce (osobne sztuki czy duplikat?)`));
return {plan,newCategories:[...newCats],flags};
}

return {run:run,firstCode:firstCode,getPos:getPos,resolveCat:resolveCat,resolveCar:resolveCar,carFromOEPrefix:carFromOEPrefix,catObj:catObj,CATFLAT:CATFLAT,M:M,CAT:CAT};
}};
