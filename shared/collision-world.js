(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./content'),require('./open-world'),require('./scenery-profiles'));
  else root.UZCollisionWorld=factory(root.UZ,root.UZOpenWorld,root.UZSceneryProfiles);
})(typeof globalThis!=='undefined'?globalThis:this,function(Content,World,Profiles){
  'use strict';
  const TAU=Math.PI*2,CHUNK=World.CHUNK,CELL=128,RANGE=420;
  const chunks=new Map(),queries=new Map(),maps=new Map();
  const limits={chunks:96,queries:192,maps:32};
  const alienHouses=new Set(['namek','kanassa','yardrat','divine','sacred','zeno','champa']);
  function remember(cache,key,value,limit){
    cache.delete(key);cache.set(key,value);
    if(cache.size>limit)cache.delete(cache.keys().next().value);
    return value;
  }
  function cached(cache,key){const value=cache.get(key);if(value)remember(cache,key,value,limits[cache===chunks?'chunks':cache===queries?'queries':'maps']);return value;}
  function hash(x,y){let n=Math.imul(Math.round(x),374761393)^Math.imul(Math.round(y),668265263);n=Math.imul(n^(n>>>13),1274126177);return(n^(n>>>16))>>>0;}
  function silhouette(rx,ry,cut=.24){return[[-rx*(1-cut),-ry],[rx*(1-cut),-ry],[rx,-ry*(1-cut)],[rx,ry*(1-cut)],[rx*(1-cut),ry],[-rx*(1-cut),ry],[-rx,ry*(1-cut)],[-rx,-ry*(1-cut)]];}
  function spec(shape,rx,ry,height,surface=false,solid=true){return{shape,rx,ry,height,surface,solid};}
  function nature(index){
    // Tree crowns do not block feet. Each species has a separate trunk base.
    if(index<49){
      const trunk=index===12||index===26 ? .14 : index===3 ? .045 : index>=28 ? .07 : index===6||index===7||index===21||index===22 ? .055 : .085;
      return spec('ellipse',trunk,trunk*.62,.63,false);
    }
    if(index>=84&&index<=111||[114,117,118,119,139,142,143,146,174,175,186,187,188,190].includes(index))return spec('ellipse',.24,.10,.08,false,false);
    if(index>=163&&index<=173||[176,179,180,189].includes(index))return spec('ellipse',index===165 ? .12 : .075,.05,.59,false);
    if([140,141,144,145,147,168,169,170,171,172,173,185].includes(index))return spec('ellipse',.11,.07,.48,false);
    if([112,113].includes(index))return spec('polygon',.35,.21,index===113 ? .38 : .12,true);
    if([115,137].includes(index))return spec('polygon',.36,.12,.17,true);
    if(index===116||index===120)return spec('ellipse',.14,.085,.46,false);
    if([122,123,126,127,132,133,134,191,192].includes(index))return spec('polygon',.13,.095,.62,true);
    if([124,125,135,136,193,194,195].includes(index))return spec('polygon',index===193 ? .29 : .21,.14,.60,true);
    if(index===129)return spec('polygon',.36,.115,.46,true);
    if(index===130)return spec('polygon',.32,.20,.35,true);
    if(index===138||index===183)return spec('ellipse',.29,.19,.27,true);
    if([64,65,74,75,76,77,149,153].includes(index))return spec('polygon',.17,.105,.61,true);
    if([50,52,55,56,78,81,148,151,157,158,160,177,182].includes(index))return spec('polygon',.27,.16,.59,true);
    if([53,66,154,155,156].includes(index))return spec('polygon',.36,.21,.31,true);
    if([67,68,69,70,71,121].includes(index))return spec('polygon',.26,.16,.48,true);
    if([159,161,162].includes(index))return spec('polygon',.27,.17,.64,true);
    if(index===181)return spec('ellipse',.26,.11,.60,false,false);
    return spec('polygon',.32,.19,.43,true);
  }
  function furniture(index){
    const row=Math.floor(index/14);
    if([9,10,32,38,171,177,178,179,182,183,184,185,186,187].includes(index))return spec('ellipse',.30,.16,.04,false,false);
    if(index===131||index===132)return spec('polygon',.085,.075,.64,true);
    if(row===0)return spec([0,3,8].includes(index)?'ellipse':'polygon',index===5 ? .35 : .24,.145,.47,true);
    if(row===1)return spec([14,16,19,22,27].includes(index)?'ellipse':'polygon',.34,.19,.32,true);
    if(row===2)return spec('polygon',.34,.22,.25,true);
    if(row===3)return spec('polygon',.26,.17,.60,true);
    if(row===4)return spec('ellipse',[58,64,66].includes(index) ? .04 : .095,.07,.64,false,![58,64,66].includes(index));
    if(row===5)return spec([73,74,75,80,83].includes(index)?'ellipse':'polygon',.29,.18,.43,true);
    if(row===6)return spec([85,87,90].includes(index)?'ellipse':'polygon',.28,.17,.56,true);
    if(row===7)return spec([98,99,101,102,106,108,110].includes(index)?'ellipse':'polygon',.20,.13,.40,false);
    if(row===8)return spec([116,117,120,123].includes(index)?'ellipse':'polygon',index<=114 ? .31 : .28,.18,index<=114 ? .58 : .35,true);
    if(row===9){
      if(index<=129)return spec('polygon',.36,index===129 ? .09 : .045,index===129 ? .48 : .55,true);
      if(index===138)return spec('ellipse',.33,.20,.27,true);
      return spec('ellipse',[133,134,137,139].includes(index) ? .055 : .16,.065,.65,false);
    }
    if(row===10)return spec('ellipse',index===143 ? .29 : .34,index===143 ? .19 : .22,index===151 ? .46 : .57,true);
    if(row===11){
      if([154,155,156,158,159,162].includes(index))return spec('ellipse',.36,.18,.35,true);
      if(index===163)return spec('ellipse',.095,.07,.58,false);
      if(index===165||index===167)return spec('ellipse',.17,.12,.64,false);
      return spec('ellipse',.27,.18,.58,true);
    }
    if(row===12){
      if(index===180||index===181)return spec('polygon',.33,.21,.16,true);
      if(index===173||index===174||index===176)return spec('polygon',.34,.11,.20,true);
      if(index===175)return spec('polygon',.25,.20,.40,true);
      return spec('ellipse',index===168||index===172 ? .08 : .15,.09,.59,false);
    }
    if(index===188)return spec('ellipse',.29,.17,.45,true);
    if(index===190)return spec('ellipse',.15,.10,.58,false);
    return spec('ellipse',index===191?.24:.16,.105,.59,false);
  }
  function outline(points){
    points=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),lo=[],hi=[];
    for(const p of points){while(lo.length>1&&cross(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}
    for(let i=points.length-1;i>=0;i--){const p=points[i];while(hi.length>1&&cross(hi[hi.length-2],hi[hi.length-1],p)<=0)hi.pop();hi.push(p);}
    lo.pop();hi.pop();return lo.concat(hi);
  }
  function bounds(points){return{rx:Math.max(1,...points.map(p=>Math.abs(p[0]))),ry:Math.max(1,...points.map(p=>Math.abs(p[1])))};}
  function spriteProfile(sheet,index,size){
    const material=sheet==='nature'?nature(index):furniture(index),source=Profiles?.sheets?.[sheet]?.[index];
    if(!source)return{...material,shape:'polygon',points:silhouette(size*.2,size*.08),rx:size*.2,ry:size*.08,height:size*.5,dy:0};
    const scale=size/Profiles.cell,convert=points=>points.map(([x,y])=>[x*scale,y*scale]);
    const base=source.base.flatMap(convert),points=outline(base),sections=[];
    for(const level of source.levels)for(const part of level.parts){const sectionPoints=convert(part);sections.push({shape:'polygon',points:sectionPoints,...bounds(sectionPoints),minZ:level.min*scale,maxZ:level.max*scale,ceiling:!!source.opening&&level.min>source.height*.35&&level.parts.length===1});}
    const topLevel=source.levels[source.levels.length-1],top=outline((topLevel?.parts||source.base).flatMap(convert));
    const surfaceShape={shape:'polygon',points:top,...bounds(top)};
    return{...material,shape:'polygon',points,...bounds(points),height:source.height*scale,topHeight:(source.visualHeight??source.height)*scale,dy:(source.baseY/Profiles.cell-.84)*size,sections,surfaceShape,tree:source.tree,bounds:source.bounds.map(n=>n*scale)};
  }
  function colliderFor(o,world){
    if(!o||!Number.isFinite(o.x)||!Number.isFinite(o.y))return null;
    const kind=o.kind||o.type||'object',id=o.id||world+':'+kind+':'+Math.round(o.x)+':'+Math.round(o.y);
    if(kind==='mountain'){
      const r=o.r||o.radius||90,h=o.h||o.height||55,points=[];
      for(let i=0;i<18;i++){const a=i/18*TAU,k=1+.1*Math.sin(i*2.6+(o.phase||0));points.push([Math.cos(a)*r*k,Math.sin(a)*r*.55*k]);}
      const surfaceShape={shape:'polygon',points,rx:r*1.1,ry:r*.605};
      return{id,x:o.x,y:o.y+h,shape:'polygon',rx:r*1.1,ry:r*.605,points,height:h,z:0,surface:true,solid:true,kind,surfaceShape,visualBounds:{left:o.x-r*1.1,right:o.x+r*1.1,top:o.y-r*.605,bottom:o.y+h+r*.605}};
    }
    if(o.shape&&Number.isFinite(o.rx)&&Number.isFinite(o.ry))return{...o,id,height:o.height||0,z:o.z||0,surface:!!o.surface,solid:o.solid!==false,kind};
    if(o.type==='resource'||kind==='herb'||kind==='grass'||kind==='flower')return{id,x:o.x,y:o.y,shape:'ellipse',rx:8,ry:5,height:9,z:0,surface:false,solid:false,kind};
    const positionHash=hash(o.x,o.y),profile=World.profile(world);
    const structure=o.type==='structure'||['camp','workbench','gravity','garden','beacon'].includes(kind);
    let sheet=o.sheet||o.sprite?.sheet,index=typeof o.sprite==='number'?o.sprite:o.sprite?.index,size=o.size;
    if(kind==='tree'){
      sheet='nature';index=profile.flora[positionHash%profile.flora.length]??140;size=Math.max(80,Math.min(190,(o.size||35)*3.6));
    }else if(kind==='rock'){
      sheet='nature';index=profile.rocks[positionHash%profile.rocks.length];size=Math.max(50,(o.size||20)*3.2);
    }else if(structure){
      sheet='furniture';index=index??({camp:140,workbench:88,gravity:167,garden:105,beacon:165}[kind]);size=size||(['camp','gravity'].includes(kind)||Math.floor(index/14)===10?145:110);
    }else if(kind==='house'&&index==null){sheet='furniture';index=world==='demon'?145+positionHash%3:alienHouses.has(world)?140+positionHash%5:140+positionHash%14;size=(o.size||65)*3.1;}
    if(index!=null){
      sheet=sheet||'furniture';size=size||215;
      const data=spriteProfile(sheet,index,size),dy=structure?15:0;
      const collider={id,x:o.x,y:o.y+data.dy+dy,shape:data.shape,rx:data.rx,ry:data.ry,points:data.points,height:Math.max(1,data.height),z:o.z||0,surface:data.tree?false:data.surface,solid:data.solid,kind,sheet,sprite:index,sections:data.sections,surfaceShape:data.surfaceShape};
      if(data.bounds){const [left,top,right,bottom]=data.bounds;collider.visualBounds={left:o.x-size/2+left,right:o.x-size/2+right,top:o.y+dy-size*.84+top,bottom:o.y+dy-size*.84+bottom};}
      collider.topHeight=data.topHeight??collider.height;
      collider.queryRx=Math.max(collider.rx,...(data.sections||[]).map(s=>s.rx));
      collider.queryRy=Math.max(collider.ry,...(data.sections||[]).map(s=>s.ry));
      return collider;
    }
    const r=Math.max(4,o.radius||o.size||12);
    return{id,x:o.x,y:o.y,shape:'ellipse',rx:r,ry:r*.62,height:o.height||r*1.4,z:o.z||0,surface:false,solid:o.solid!==false,kind};
  }
  function collidersFor(o,world){
    const body=colliderFor(o,world);return body?[body]:[];
  }
  function worldMap(world){const prior=cached(maps,world);return prior||remember(maps,world,Content.worldData(world),limits.maps);}
  function chunkColliders(world,cx,cy){
    const key=world+':'+cx+':'+cy,prior=cached(chunks,key);if(prior)return prior;
    const terrain=World.chunk(world,cx,cy),features=World.features(world,cx,cy,terrain),list=[];
    for(const feature of features)list.push(...collidersFor(feature,world));
    for(const home of features){
      if(home.kind!=='house')continue;
      for(let i=0;i<5;i++){
        const h=hash(home.x+i*47,home.y),angle=i*1.256+.4,x=home.x+Math.cos(angle)*(home.size+65),y=home.y+Math.sin(angle)*(home.size*.5+43);
        const index=[112+h%14,56+h%14,98+h%14,168+h%14,182+h%14][i];
        list.push(...collidersFor({id:world+':house-dressing:'+Math.round(x)+':'+Math.round(y),kind:'dressing',x,y,sheet:'furniture',sprite:index,size:62},world));
      }
    }
    for(const b of worldMap(world).buildings)if(Math.floor(b.x/CHUNK)===cx&&Math.floor(b.y/CHUNK)===cy)list.push(...collidersFor({...b,kind:'landmark',sheet:'furniture',size:215},world));
    // Match the small dressing sprites emitted by UZWorldKit.dress. Grasses,
    // herbs and flowers retain metadata but never become invisible walls.
    for(const o of terrain.objects){
      const h=hash(o.x,o.y);if(h%3!==0)continue;
      for(let i=0;i<2;i++){
        const x=o.x+45+i*38,y=o.y+35-i*20,index=82+(h+i*7)%26;
        // This secondary layer has a visual draw budget. Keep its small leaf,
        // flower and pebble accents passable so a culled accent is never a wall.
        list.push(...collidersFor({id:world+':dressing:'+Math.round(x)+':'+Math.round(y),kind:'dressing',x,y,sheet:'nature',sprite:index,size:38+h%22},world).map(c=>({...c,solid:false,surface:false})));
      }
    }
    return remember(chunks,key,list,limits.chunks);
  }
  function close(c,x,y,radius){return Math.abs(c.x-x)<=radius+(c.queryRx??c.rx??0)&&Math.abs(c.y-y)<=radius+(c.queryRy??c.ry??0);}
  function nearby(world,x,y,extra=[]){
    world=typeof world==='string'?world:world?.id||'earth';
    if(!Number.isFinite(x)||!Number.isFinite(y))return[];
    const qx=Math.floor(x/CELL),qy=Math.floor(y/CELL),key=world+':'+qx+':'+qy;
    let local=cached(queries,key);
    if(!local){
      local=[];
      if(world!=='space'){
        const mx=(qx+.5)*CELL,my=(qy+.5)*CELL,cx=Math.floor(mx/CHUNK),cy=Math.floor(my/CHUNK);
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)for(const collider of chunkColliders(world,cx+dx,cy+dy))if(close(collider,mx,my,RANGE+CELL/2))local.push(collider);
      }
      remember(queries,key,local,limits.queries);
    }
    if(!extra?.length)return local;
    const additions=extra.filter(o=>o&&(!o.world||o.world===world)&&close(o,x,y,RANGE));
    return additions.length?local.concat(additions):local;
  }
  return{nearby,colliderFor,collidersFor,RANGE,CELL};
});
