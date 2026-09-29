(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./content'),require('./universe-atlas'),require('./quests'));
  else root.UZOpenWorld=factory(root.UZ,root.UZUniverseAtlas,root.UZQuests);
})(typeof globalThis!=='undefined'?globalThis:this,function(UZ,Atlas,Quests){
  const CHUNK=1600;
  const earth=[['Montanhas Paozu',1700,1740,1],['Cidade do Oeste',10200,3400,5],['Deserto de Yamcha',-7200,6300,9],['Território da Red Ribbon',6200,-9800,14],['Torre Karin',-12000,-6200,20],['Terras do torneio',14200,13500,28]];
  // Canonical atlas sites are indexed once. A streamed chunk only consults its
  // own cell, so world size does not increase work per frame or simulation tick.
  // Live quest anchors stay in place until their entire quest/NPC cluster moves.
  const atlasCells=new Map(),calmCells=new Set(),atlasRegionCenters=new Map(),surfaceAtlas=new Map(),clearanceCells=new Map();
  const scenicType={city:'market',district:'market',village:'outpost',home:'outpost',port:'market',market:'market',laboratory:'outpost',hospital:'outpost',school:'dojo',restaurant:'market',fortress:'fortress',palace:'shrine',temple:'shrine',sanctuary:'shrine','sky-sanctuary':'shrine',tower:'shrine',training:'dojo',arena:'dojo',battlefield:'ruins',ruin:'ruins',cave:'canyon',mountain:'canyon',wilderness:'wilderness',wetland:'orchard',garden:'orchard',route:'outpost',portal:'shrine',tribunal:'shrine',arrival:'outpost',shelter:'outpost',quarry:'quarry',social:'market',government:'fortress',media:'market'};
  const hiddenOnSurface=new Set(['interior','sky-sanctuary','snake-entry']);
  const legacyByRegion=new Map();
  if(Atlas){
    for(const place of Atlas.SITES)if(place.legacyAnchor){
      const key=place.world+':'+place.region;
      const group=legacyByRegion.get(key)||[];group.push(place);legacyByRegion.set(key,group);
    }
  }
  function atlasPosition(place){
    if(typeof place==='string')place=Atlas?.getSite(place);
    if(!place)return null;
    if(place.legacyAnchor)return place.legacyAnchor;
    const anchors=legacyByRegion.get(place.world+':'+place.region)||[];
    let nearest=null,distance=Infinity;
    for(const a of anchors){const d=Math.hypot(place.x-a.x,place.y-a.y);if(d<distance){nearest=a;distance=d;}}
    if(nearest&&distance<20000)return{x:Math.round(nearest.legacyAnchor.x+(place.x-nearest.x)*.58),y:Math.round(nearest.legacyAnchor.y+(place.y-nearest.y)*.58)};
    return{x:place.x,y:place.y};
  }
  if(Atlas){
    for(const source of Atlas.SITES){
      if(hiddenOnSurface.has(source.kind)||hiddenOnSurface.has(source.id))continue;
      const position=atlasPosition(source),site={...source,x:position.x,y:position.y,atlasId:source.id,productionX:source.x,productionY:source.y};
      surfaceAtlas.set(source.id,site);
      const cx=Math.floor(site.x/CHUNK),cy=Math.floor(site.y/CHUNK),key=site.world+':'+cx+':'+cy;
      const group=atlasCells.get(key)||[];group.push(site);atlasCells.set(key,group);
      if(['city','village','home','market','hospital','school','arrival','port','tribunal','sanctuary','training'].includes(site.kind))
        for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)calmCells.add(site.world+':'+(cx+dx)+':'+(cy+dy));
      if(['city','village','wilderness','fortress','temple','sanctuary'].includes(site.kind)){
        const regions=atlasRegionCenters.get(site.world)||[];
        if(!regions.some(r=>r.name===site.region&&Math.hypot(r.x-site.x,r.y-site.y)<6000))
          regions.push({name:site.region,x:site.x,y:site.y,level:site.level,radius:Math.min(site.radius,14000)});
        atlasRegionCenters.set(site.world,regions);
      }
    }
    for(const group of atlasCells.values())group.sort((a,b)=>Number(b.production==='hero-landmark')-Number(a.production==='hero-landmark')||a.id.localeCompare(b.id));
  }
  function atlasInChunk(id,cx,cy){return atlasCells.get(id+':'+cx+':'+cy)||[];}
  function reserve(point,radius){
    const clearance={x:point.x,y:point.y,radius};
    for(let cx=Math.floor((point.x-radius-220)/CHUNK);cx<=Math.floor((point.x+radius+220)/CHUNK);cx++)
      for(let cy=Math.floor((point.y-radius-220)/CHUNK);cy<=Math.floor((point.y+radius+220)/CHUNK);cy++){
        const key=point.world+':'+cx+':'+cy,group=clearanceCells.get(key)||[];
        group.push(clearance);clearanceCells.set(key,group);
      }
  }
  for(const site of surfaceAtlas.values())reserve(site,site.kind==='wilderness'||site.kind==='route'?130:210);
  for(const world of UZ.WORLDS){
    reserve({world:world.id,x:1700,y:1740},330);
    reserve({world:world.id,x:1540,y:1640},160);
  }
  if(Quests)for(const marker of Object.values(Quests.LANDMARKS))reserve(marker,Math.max(150,marker.radius+45));
  const firstMeeting=Quests?.LANDMARKS.bulma||{x:1700,y:8250};
  function pathsInChunk(id,cx,cy){
    if(id!=='earth'||cx!==Math.floor(firstMeeting.x/CHUNK)||cy<1||cy>Math.floor(firstMeeting.y/CHUNK))return[];
    return[{id:'paozu-first-journey',x1:firstMeeting.x,y1:Math.max(1450,cy*CHUNK),x2:firstMeeting.x,y2:Math.min(firstMeeting.y+300,(cy+1)*CHUNK),width:160}];
  }
  function distanceToPath(x,y,path){
    const dx=path.x2-path.x1,dy=path.y2-path.y1,length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((x-path.x1)*dx+(y-path.y1)*dy)/length)):0;
    return Math.hypot(x-path.x1-dx*t,y-path.y1-dy*t);
  }
  function clearForTerrain(id,cx,cy,x,y,radius=0){
    const actualX=Math.floor(x/CHUNK),actualY=Math.floor(y/CHUNK);
    const points=clearanceCells.get(id+':'+actualX+':'+actualY)||[];
    if(points.some(point=>Math.hypot(x-point.x,y-point.y)<point.radius+radius))return false;
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)
      if(pathsInChunk(id,actualX+dx,actualY+dy).some(path=>distanceToPath(x,y,path)<path.width/2+radius+30))return false;
    return true;
  }
  const planetProfiles={"earth":{"sites":["wilderness","wilderness","orchard","canyon","checkpoint","ruins","market","dojo","outpost"],"flora":[0,1,2,10,12,14,15,16,20,25],"rocks":[56,57,58,59,60,61,62,72,73],"river":true},"namek":{"sites":["wilderness","wilderness","shrine","quarry","crash","checkpoint","outpost"],"flora":[28,29,30,31,32,33,35,36,38],"rocks":[60,63,68,71,82,83],"river":true,"names":["Aldeias do lago","Escarpas azuis","Minas do invasor","Campos da Força Ginyu","Cráter dos três sóis"]},"vegeta":{"sites":["fortress","checkpoint","quarry","canyon","dojo","wilderness"],"flora":[],"rocks":[148,149,150,151,152,153,154,156],"river":false,"names":["Distrito dos quartéis","Cânion dos recrutas","Minas rubras","Planalto da elite","Fronteira de lançamento"]},"future":{"sites":["ruins","ruins","crash","outpost","checkpoint","wilderness"],"flora":[140,141,144,187],"rocks":[72,73,122,123,129,130,131],"river":true,"names":["Avenidas silenciosas","Zona industrial","Abrigos da resistência","Cratera dos androides","Distrito abandonado"]},"otherworld":{"sites":["orchard","shrine","dojo","wilderness"],"flora":[4,19,164,168,169],"rocks":[74,75,76,191,192],"river":false,"names":["Jardins das almas","Mirante das nuvens","Pátio dos antigos","Bosque violeta","Planície dos mestres"]},"demon":{"sites":["canyon","fortress","ruins","shrine","quarry"],"flora":[43,48,163,166,173],"rocks":[157,158,159,160,161,162],"river":false,"names":["Fendas de enxofre","Bosque sombrio","Cidadela dos guardas","Pedreiras negras","Fronteira do abismo"]},"vampa":{"sites":["wilderness","wilderness","canyon","quarry","crash"],"flora":[49,145,146,147,186],"rocks":[51,55,63,66,148,155],"river":false,"names":["Ninhos das feras","Ermos de ossadas","Garganta do vento","Bacia ácida","Terras sem abrigo"]},"divine":{"sites":["shrine","orchard","dojo","wilderness"],"flora":[163,164,169,170],"rocks":[122,124,127,191,192],"river":false,"names":["Jardins de Whis","Terraços de treinamento","Bosque celeste","Pátio do repouso","Mirante estelar"]},"arena":{"sites":["dojo","ruins","canyon"],"flora":[],"rocks":[52,54,72,73,78,129,130],"river":false,"names":["Anel exterior","Plataformas fraturadas","Corredor dos duelos","Centro do torneio","Limite do vazio"]},"yardrat":{"sites":["dojo","shrine","market","outpost","wilderness"],"flora":[34,37,40,164,166],"rocks":[67,71,74,76,133],"river":true,"names":["Terraços de Pybara","Jardins da mente","Caminho dos ecos","Mercado dos viajantes","Pedras do retorno"]},"cereal":{"sites":["ruins","market","wilderness","canyon","outpost"],"flora":[8,12,14,26,137],"rocks":[57,58,72,123,126,135],"river":true,"names":["Santuário esquecido","Colinas dos sobreviventes","Mercado reconstruído","Vale das emboscadas","Bosque da memória"]},"sadala":{"sites":["market","dojo","checkpoint","fortress","outpost"],"flora":[2,3,17,25],"rocks":[51,54,58,79,80],"river":true,"names":["Distrito da guarda","Pátios saiyajins","Estrada real","Quartéis da capital","Colinas da patrulha"]},"champa":{"sites":["shrine","orchard","market","dojo"],"flora":[4,19,39,164,168],"rocks":[71,75,122,124,192],"river":false,"names":["Jardins de Vados","Terraços do banquete","Pátios púrpura","Alamedas do templo","Arena dos convidados"]},"tsufuru":{"sites":["ruins","quarry","crash","fortress","checkpoint"],"flora":[44,45,141,187],"rocks":[62,63,122,129,130,132],"river":true,"names":["Complexo de máquinas","Laboratórios tomados","Ruínas da metrópole","Bacia de energia","Colinas dos transmissores"]},"kanassa":{"sites":["market","shrine","ruins","outpost","wilderness"],"flora":[28,30,35,42,165],"rocks":[60,61,68,83,112,113],"river":true,"names":["Lagoas do presságio","Recifes antigos","Aldeias da maré","Pedras do oráculo","Praia dos invasores"]},"konatsu":{"sites":["market","orchard","ruins","shrine","wilderness"],"flora":[4,8,10,17,19],"rocks":[57,60,74,123,125,135],"river":true,"names":["Praça dos músicos","Pomares do sino","Templo do selo","Ruínas do gigante","Trilha do flautista"]},"sacred":{"sites":["wilderness","wilderness","shrine","orchard","dojo"],"flora":[0,1,4,10,12,169],"rocks":[57,60,74,124,125],"river":true,"names":["Planícies do silêncio","Bosque dos Kaioshins","Mirante ancestral","Jardins da criação","Campo da última batalha"]},"zeno":{"sites":["shrine","dojo","orchard"],"flora":[163,164,169],"rocks":[121,124,127,191,192],"river":false,"names":["Pátios dos universos","Jardins simétricos","Corredor dos guardiões","Terraços azuis","Limite do palácio"]},"frieza":{"sites":["checkpoint","fortress","quarry","crash","outpost"],"flora":[],"rocks":[54,56,62,63,78,81],"river":false,"names":["Hangares imperiais","Quartéis da força","Mina de combustível","Cemitério de naves","Cinturão de patrulha"]}};
  const profile=id=>planetProfiles[id]||planetProfiles.earth;
  const riverX=(id,y)=>4100+(id==='earth'?0:(UZ.getWorld(id).seed%9-4)*710)+Math.sin(y/(1700+(id==='earth'?0:UZ.getWorld(id).seed%600)))*1100+Math.sin(y/620)*180;
  const regionCache=new Map();
  function regions(id){
    if(regionCache.has(id))return regionCache.get(id);
    const prior=id==='earth'?earth.map(([name,x,y,level])=>({name,x,y,level})):Array.from({length:6},(_,i)=>({name:i===0?UZ.getWorld(id).region:profile(id).names?.[i-1]||`${UZ.getWorld(id).region} · região ${i+1}`,x:1700+Math.cos(i*2.4)*i*4500,y:1740+Math.sin(i*2.4)*i*4500,level:1+Math.max(0,UZ.WORLDS.findIndex(w=>w.id===id))*3+i*5}));
    const result=prior.concat(atlasRegionCenters.get(id)||[]);
    regionCache.set(id,result);if(regionCache.size>64)regionCache.delete(regionCache.keys().next().value);return result;
  }
  function hash(id,x,y){let h=UZ.getWorld(id).seed|0;h=Math.imul(h^x,374761393);h=Math.imul(h^y,668265263);return (h^(h>>>13))>>>0;}
  function region(id,x,y){const entries=regions(id);let best=entries[0],dist=Infinity;for(const r of entries){const d=Math.hypot(x-r.x,y-r.y);if(d<dist){dist=d;best=r;}}return {...best,level:best.level+Math.floor(Math.max(0,dist-4000)/5000),frontier:dist>Math.max(9000,best.radius||0)};}
  const layouts={
    wilderness:{name:'Reserva selvagem',formation:'scattered',troops:[0,2],props:[],mood:'quiet'},
    orchard:{name:'Pomar e trilha',formation:'line',troops:[0,0],props:[98,106,121],mood:'quiet'},
    canyon:{name:'Passagem do desfiladeiro',formation:'pincer',troops:[2,4],props:[126,130],mood:'ambush'},
    checkpoint:{name:'Barreira militar',formation:'line',troops:[3,5],props:[128,128,130,91,118,119],mood:'military'},
    quarry:{name:'Mina de cristais',formation:'scattered',troops:[2,4],props:[88,90,96,118],mood:'industry'},
    ruins:{name:'Ruínas soterradas',formation:'depth',troops:[1,3],props:[185,187,190],mood:'ancient'},
    market:{name:'Entreposto de viajantes',formation:'street',troops:[0,0],props:[112,113,114,22,18,121,123,138],mood:'social'},
    dojo:{name:'Pátio de treinamento',formation:'duel',troops:[1,1],props:[168,169,172,173,177,180],mood:'trial'},
    crash:{name:'Nave abatida',formation:'pincer',troops:[2,5],props:[154,157,118,84,92],mood:'salvage'},
    fortress:{name:'Fortaleza ocupada',formation:'depth',troops:[5,7],props:[128,128,130,91,155,167,118,120],mood:'military'},
    shrine:{name:'Santuário do ki',formation:'duel',troops:[1,2],props:[188,187,177,194],mood:'ancient'},
    outpost:{name:'Acampamento de expedição',formation:'street',troops:[0,2],props:[145,153,84,119],mood:'social'}
  };
  const scenery={"orchard":[["nature",9,-260,-180,210],["nature",23,-80,-210,200],["nature",24,130,-170,230],["furniture",119,270,70,145],["furniture",115,310,130,85]],"canyon":[["nature",53,0,-330,420],["nature",148,-340,-40,280],["nature",149,340,-140,330],["nature",153,-330,240,280],["nature",155,350,230,280]],"checkpoint":[["furniture",148,-330,-260,270],["furniture",91,-130,-250,120],["furniture",163,310,-240,160],["furniture",130,-360,0,190],["furniture",130,-220,0,190],["furniture",130,220,0,190],["furniture",130,360,0,190],["furniture",118,-320,150,120]],"quarry":[["nature",68,-190,-200,170],["nature",67,100,-230,210],["nature",52,270,-80,300],["furniture",96,-300,70,150],["furniture",88,-150,120,130],["furniture",118,230,100,125]],"ruins":[["nature",128,-180,-300,340],["nature",123,220,-240,260],["nature",129,-300,10,260],["nature",131,250,80,300],["nature",135,-230,270,180],["nature",136,100,250,150]],"market":[["furniture",147,0,-470,350],["furniture",112,-270,-160,200],["furniture",113,270,-160,200],["furniture",114,-260,140,200],["furniture",121,260,140,185],["furniture",120,-330,320,140],["furniture",123,340,330,125],["furniture",137,-95,70,100],["furniture",137,95,70,100]],"dojo":[["furniture",131,0,-330,240],["furniture",168,-340,-100,125],["furniture",172,340,-100,125],["furniture",169,-330,160,120],["furniture",170,330,160,120],["furniture",173,-340,330,140]],"crash":[["furniture",155,-190,-250,340],["furniture",157,270,-120,240],["furniture",84,-320,80,120],["furniture",118,240,230,130],["furniture",92,-200,150,110],["nature",158,120,-320,200]],"fortress":[["furniture",148,0,-390,310],["furniture",91,-220,-180,130],["furniture",167,230,-170,170],["furniture",163,200,-390,165],["furniture",129,-410,-280,230],["furniture",129,-410,-110,230],["furniture",129,-410,60,230],["furniture",129,-410,230,230],["furniture",129,410,-280,230],["furniture",129,410,-110,230],["furniture",129,410,60,230],["furniture",129,410,230,230],["furniture",129,-290,-430,210],["furniture",129,-145,-430,210],["furniture",129,0,-430,210],["furniture",129,145,-430,210],["furniture",129,290,-430,210],["furniture",130,-230,350,220],["furniture",130,230,350,220],["furniture",118,-230,110,120]],"shrine":[["nature",124,0,-330,330],["nature",122,-320,-110,270],["nature",122,320,-110,270],["nature",123,-320,240,240],["nature",123,320,240,240],["furniture",177,0,-120,200],["nature",127,0,320,190]],"outpost":[["furniture",145,-260,-200,260],["furniture",153,250,-170,280],["furniture",62,0,-100,95],["furniture",119,300,170,140],["furniture",84,-220,130,130],["furniture",36,-300,280,160]]};
  const palettes={earth:['wilderness','wilderness','orchard','canyon','checkpoint','ruins','market','dojo','outpost'],namek:['wilderness','wilderness','shrine','quarry','crash','checkpoint','outpost'],vegeta:['canyon','fortress','checkpoint','quarry','dojo','wilderness'],future:['ruins','ruins','crash','fortress','outpost','wilderness'],demon:['canyon','ruins','fortress','shrine','wilderness'],space:['wilderness','crash','checkpoint']};
  const formations={line:(i,n)=>[(i-(n-1)/2)*145,-20],street:(i,n)=>[i%2?-170:170,Math.floor(i/2)*175-140],pincer:(i,n)=>[i%2?-260:260,Math.floor(i/2)*165-130],depth:(i,n)=>[(i%3-1)*155,Math.floor(i/3)*230-150],duel:(i,n)=>[(i-(n-1)/2)*190,0],scattered:(i,n)=>[Math.cos(i*2.4)*(180+i*45),Math.sin(i*2.4)*(180+i*45)]};
  const rosters={earth:[['soldier','Batedor','scout'],['android','Atirador Red Ribbon','artillery'],['generalBlue','Oficial','duelist'],['nappa','Mercenário pesado','juggernaut']],namek:[['soldier','Patrulheiro de Freeza','scout'],['jeice','Especialista de ki','artillery'],['zarbon','Executor','duelist'],['dodoria','Tropa de choque','juggernaut']],vegeta:[['raditz','Explorador saiyajin','skirmisher'],['soldier','Recruta saiyajin','scout'],['vegeta','Elite saiyajin','duelist'],['nappa','Veterano saiyajin','juggernaut']],future:[['android','Unidade de reconhecimento','scout'],['android','Unidade de supressão','artillery'],['cell','Bioandroide errante','duelist'],['android','Unidade blindada','juggernaut']]};
  function chunk(id,cx,cy){
    const random=UZ.rng(hash(id,cx,cy)),x=cx*CHUNK,y=cy*CHUNK,r=region(id,x+800,y+800);
    const landmarks=atlasInChunk(id,cx,cy),primary=landmarks[0],paths=pathsInChunk(id,cx,cy);
    const starterTrail=paths.length>0;
    const palette=id==='space'?palettes.space:profile(id).sites;
    let type=palette[Math.floor(random()*palette.length)];
    if(id==='earth'&&r.name.includes('Red Ribbon'))type=['checkpoint','fortress','crash','wilderness'][hash(id,cx,cy)%4];
    if(id==='earth'&&r.name.includes('Cidade'))type=['market','ruins','outpost','orchard'][hash(id,cx,cy)%4];
    if(primary)type=scenicType[primary.kind]||'outpost';
    else if(starterTrail)type='outpost';
    const template=layouts[type],biome=id==='namek'?'namek':id==='earth'?(r.name.includes('Deserto')?'desert':r.name.includes('Paozu')?'forest':'grass'):['demon','vegeta','vampa'].includes(id)?'desert':['frieza','future'].includes(id)?'waste':'plateau';
    const site=primary?{x:primary.x,y:primary.y,type,name:primary.name,mood:template.mood,formation:template.formation,atlasId:primary.id,kind:primary.kind}:
      starterTrail?{x:firstMeeting.x,y:cy===Math.floor(firstMeeting.y/CHUNK)?firstMeeting.y:y+800,type,name:cy===Math.floor(firstMeeting.y/CHUNK)?'Encontro no caminho de Paozu':'Trilha de Paozu',mood:'social',formation:'street',storySite:cy===Math.floor(firstMeeting.y/CHUNK)?'bulma':null}:
      {x:x+400+random()*800,y:y+400+random()*800,type,name:template.name,mood:template.mood,formation:template.formation};
    const river=riverX(id,site.y);
    if(!primary&&!starterTrail&&profile(id).river&&Math.abs(site.x-river)<620)site.x=river+(site.x<river?-640:640);
    const objects=Array.from({length:biome==='forest'?72:biome==='desert'?26:40},()=>({x:x+random()*CHUNK,y:y+random()*CHUNK,size:12+random()*33,kind:random()<.68&&profile(id).flora.length>0?'tree':'rock'})).filter(o=>
      Math.hypot(o.x-1700,o.y-1740)>440&&Math.hypot(o.x-site.x,o.y-site.y)>720&&
      clearForTerrain(id,cx,cy,o.x,o.y,o.size));
    const candidateProps=primary?landmarks.slice(0,8).flatMap((marker,index)=>{
      if(['route','arrival','wilderness','wetland'].includes(marker.kind))return[];
      const markerType=scenicType[marker.kind]||'outpost';
      const rows=(scenery[markerType]||scenery.outpost).slice(0,index===0?6:3);
      return rows.map(([sheet,sprite,dx,dy,size])=>{
        const prop={x:marker.x+dx*.8,y:marker.y+dy*.8,sheet,sprite,size:size*.8,kind:'prop',atlasId:marker.id};
        const angle=Math.atan2(dy||-1,dx),radius=prop.size*.3+35;
        let tries=0;
        while(!clearForTerrain(id,cx,cy,prop.x,prop.y,radius)&&tries++<8){prop.x+=Math.cos(angle)*90;prop.y+=Math.sin(angle)*90;}
        return prop;
      }).filter(prop=>clearForTerrain(id,cx,cy,prop.x,prop.y,prop.size*.3+35));
    }):(starterTrail?scenery.outpost.filter(([, , dx])=>Math.abs(dx)>=200):scenery[type]||[])
      .map(([sheet,sprite,dx,dy,size])=>({x:site.x+dx,y:site.y+dy,sheet,sprite,size,kind:'prop'}))
      .filter(prop=>clearForTerrain(id,cx,cy,prop.x,prop.y,prop.size*.3+35));
    const props=[];
    for(const prop of candidateProps){
      // Several atlas sites can share a cell; keep their physical scenery from
      // overlapping while both rendering and collision use this same list.
      if(primary&&props.some(other=>Math.hypot(prop.x-other.x,prop.y-other.y)<(prop.size+other.size)*.3+35))continue;
      props.push(prop);
    }
    const nearStart=id!=='space'&&Math.hypot(site.x-1700,site.y-1740)<1350;
    const safeLandmark=primary&&!['fortress','battlefield','ruin','quarry','cave'].includes(primary.kind);
    const n=nearStart||safeLandmark||starterTrail||calmCells.has(id+':'+cx+':'+cy)?0:template.troops[0]+Math.floor(random()*(template.troops[1]-template.troops[0]+1));
    const roster=rosters[id]||[[UZ.getWorld(id).enemySkin,'Batedor local','scout'],[UZ.getWorld(id).enemySkin,'Sentinela de ki','artillery'],[UZ.getWorld(id).enemySkin,'Duelista','duelist'],[UZ.getWorld(id).enemySkin,'Guardião pesado','juggernaut']];
    const enemies=Array.from({length:n},(_,i)=>{const [dx,dy]=formations[template.formation](i,n),roleIndex=template.formation==='duel'?2:i===n-1&&n>3?3:i%3,unit=roster[roleIndex],elite=type==='fortress'&&i===n-1;return{x:site.x+dx,y:site.y+dy,level:r.level+(elite?3:i%3),mode:id==='space'||unit[2]==='artillery'?'flight':'ground',skin:unit[0],name:unit[1],role:unit[2],rank:elite?'elite':r.level>=12?'veteran':'regular',formation:template.formation,siteType:type};});
    for(const e of enemies){let tries=0;while(props.some(p=>Math.hypot(e.x-p.x,e.y-p.y)<p.size*.5+55)&&tries++<12)e.y+=95;}
    const mountains=mountainsInChunk(id,cx,cy,site);
    const landmarkSites=landmarks.slice(0,8).map(marker=>{
      const markerType=scenicType[marker.kind]||'outpost',layout=layouts[markerType];
      return{...marker,type:markerType,mood:layout.mood,formation:layout.formation};
    });
    return{key:id+':'+cx+':'+cy,x,y,biome,objects,site,props,enemies,region:r,landmarks,landmarkSites,paths,mountains};
  }
  function mountainsInChunk(id,cx,cy,site){
    const rand=UZ.rng(hash(id,cx,cy)^7813),mountains=[];
    for(let i=0;i<7;i++){
      const x=cx*CHUNK+rand()*CHUNK,y=cy*CHUNK+rand()*CHUNK,r=85+rand()*100;
      if(Math.hypot(x-1700,y-1740)<=650||Math.hypot(x-site.x,y-site.y)<=750||
        profile(id).river&&Math.abs(x-riverX(id,y))<=r+170||!clearForTerrain(id,cx,cy,x,y,r))continue;
      mountains.push({x,y,r,radius:r,h:35+rand()*85,phase:rand()*6,snow:id==='earth'&&rand()<.22});
    }
    return mountains;
  }
  function features(id,cx,cy,data){
    const ch=data||chunk(id,cx,cy),out=ch.mountains.map(m=>({...m,kind:'mountain'}));
    for(const prop of ch.props)out.push({...prop,radius:prop.size*.3,kind:"prop"});
    // Keep physical scenery identical to openTerrain: objects covered by a
    // cliff/building or below the river are not drawn and must not block feet.
    for(const o of ch.objects)if((!profile(id).river||Math.abs(o.x-riverX(id,o.y))>160)&&
      !ch.mountains.some(m=>Math.hypot(o.x-m.x,(o.y-m.y)*1.5)<m.r+20)&&
      !ch.props.some(p=>Math.hypot(o.x-p.x,o.y-p.y)<90))out.push({...o,radius:o.size});
    return out.map(o=>({...o,id:id+':'+o.kind+':'+Math.round(o.x)+':'+Math.round(o.y)}));
  }
  function getAtlasSite(id){
    const canonical=Atlas?.ALIASES[id]||id,visible=surfaceAtlas.get(canonical);
    if(visible)return visible;
    const source=Atlas?.getSite(canonical),position=atlasPosition(source);
    return source&&position?{...source,x:position.x,y:position.y,atlasId:source.id,productionX:source.x,productionY:source.y}:null;
  }
  return {CHUNK,regions,region,chunk,hash,features,layouts,profile,riverX,getAtlasSite,atlasInChunk,atlasPosition};
});
