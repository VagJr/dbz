'use strict';
const fs=require('fs');
const p='shared/open-world.js';let s=fs.readFileSync(p,'utf8');const start=s.indexOf('  function chunk('),end=s.indexOf('  function features(',start);
s=s.slice(0,start)+`  const layouts={
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
  const palettes={earth:['wilderness','wilderness','orchard','canyon','checkpoint','ruins','market','dojo','outpost'],namek:['wilderness','wilderness','shrine','quarry','crash','checkpoint','outpost'],vegeta:['canyon','fortress','checkpoint','quarry','dojo','wilderness'],future:['ruins','ruins','crash','fortress','outpost','wilderness'],demon:['canyon','ruins','fortress','shrine','wilderness'],space:['wilderness','crash','checkpoint']};
  const formations={line:(i,n)=>[(i-(n-1)/2)*145,-20],street:(i,n)=>[i%2?-170:170,Math.floor(i/2)*175-140],pincer:(i,n)=>[i%2?-260:260,Math.floor(i/2)*165-130],depth:(i,n)=>[(i%3-1)*155,Math.floor(i/3)*230-150],duel:()=>[0,0],scattered:(i,n)=>[Math.cos(i*2.4)*(180+i*45),Math.sin(i*2.4)*(180+i*45)]};
  const rosters={earth:[['soldier','Batedor','scout'],['android','Atirador Red Ribbon','artillery'],['generalBlue','Oficial','duelist'],['nappa','Mercenário pesado','juggernaut']],namek:[['soldier','Patrulheiro de Freeza','scout'],['jeice','Especialista de ki','artillery'],['zarbon','Executor','duelist'],['dodoria','Tropa de choque','juggernaut']],vegeta:[['raditz','Explorador saiyajin','skirmisher'],['soldier','Recruta saiyajin','scout'],['vegeta','Elite saiyajin','duelist'],['nappa','Veterano saiyajin','juggernaut']],future:[['android','Unidade de reconhecimento','scout'],['android','Unidade de supressão','artillery'],['cell','Bioandroide errante','duelist'],['android','Unidade blindada','juggernaut']]};
  function chunk(id,cx,cy){
    const random=UZ.rng(hash(id,cx,cy)),x=cx*CHUNK,y=cy*CHUNK,r=region(id,x+800,y+800);
    const palette=palettes[id]||['wilderness','canyon','shrine','ruins','quarry','dojo','outpost'];
    let type=palette[Math.floor(random()*palette.length)];
    if(id==='earth'&&r.name.includes('Red Ribbon'))type=['checkpoint','fortress','crash','wilderness'][hash(id,cx,cy)%4];
    if(id==='earth'&&r.name.includes('Cidade'))type=['market','ruins','outpost','orchard'][hash(id,cx,cy)%4];
    const template=layouts[type],biome=id==='namek'?'namek':id==='earth'?(r.name.includes('Deserto')?'desert':r.name.includes('Paozu')?'forest':'grass'):['demon','vegeta','vampa'].includes(id)?'desert':['frieza','future'].includes(id)?'waste':'plateau';
    const site={x:x+400+random()*800,y:y+400+random()*800,type,name:template.name,mood:template.mood,formation:template.formation};
    const objects=Array.from({length:biome==='forest'?72:biome==='desert'?26:40},()=>({x:x+random()*CHUNK,y:y+random()*CHUNK,size:12+random()*33,kind:random()<.68&&!['desert','waste'].includes(biome)?'tree':'rock'})).filter(o=>Math.hypot(o.x-1700,o.y-1740)>440&&Math.hypot(o.x-site.x,o.y-site.y)>310);
    const props=template.props.map((sprite,i)=>{const [dx,dy]=formations[template.formation](i,template.props.length);return{x:site.x+dx,y:site.y+dy,sprite,size:sprite>=140&&sprite<168?135:80,kind:'prop'};});
    const nearStart=id!=='space'&&Math.hypot(site.x-1700,site.y-1740)<1350;
    const n=nearStart?0:template.troops[0]+Math.floor(random()*(template.troops[1]-template.troops[0]+1));
    const roster=rosters[id]||[['demon','Éclaireur local','scout'],['gas','Sentinela de ki','artillery'],['dabura','Duelista','duelist'],['hirudegarn','Guardião pesado','juggernaut']];
    const enemies=Array.from({length:n},(_,i)=>{const [dx,dy]=formations[template.formation](i,n),roleIndex=template.formation==='duel'?2:i===n-1&&n>3?3:i%3,unit=roster[roleIndex],elite=template.type==='fortress'||type==='fortress'&&i===n-1;return{x:site.x+dx,y:site.y+dy,level:r.level+(elite?3:i%3),mode:id==='space'||unit[2]==='artillery'?'flight':'ground',skin:unit[0],name:unit[1],role:unit[2],rank:elite?'elite':r.level>=12?'veteran':'regular',formation:template.formation,siteType:type};});
    return{key:id+':'+cx+':'+cy,x,y,biome,objects,site,props,enemies,region:r};
  }
`+s.slice(end);
s=s.replace(/    for\(let i=0;i<6;i\+\+\)\{const a=i\*2\.399[^\n]+\n/,'    for(const prop of ch.props)out.push({...prop,radius:prop.size*.3,kind:"prop"});\n');s=s.replace('CHUNK,regions,region,chunk,hash,features','CHUNK,regions,region,chunk,hash,features,layouts');fs.writeFileSync(p,s);
let q='public/open-world-art.js';s=fs.readFileSync(q,'utf8');s=s.replace(/    for\(let i=0;i<6;i\+\+\)\{const a=i\*2\.399[^\n]+\n/,'    for(const prop of chunk.props)houses.push({...prop,kind:"prop"});\n');s=s.replace("kind:'house'","kind:o.kind||'house'");s=s.replace("const site=e.chunk.site;if(visible(site,350)){","const site=e.chunk.site;if(visible(site,350)&&e.houses.length){");s=s.replace("for(const r of UZOpenWorld.regions(id))",`for(const e of entries){const site=e.chunk.site;if(e.chunk.props.length&&visible(site,180)){c.fillStyle='#e8e0c4b0';c.textAlign='center';c.font='600 12px system-ui';c.fillText(site.name,site.x,site.y-260);}}
    for(const r of UZOpenWorld.regions(id))`);fs.writeFileSync(q,s);
q='src/open-world.js';s=fs.readFileSync(q,'utf8').replace("const {getWorld}","const Tactics=require('./enemy-tactics');\nconst {getWorld}");s=s.replace("p.world==='space'?'Patrulha espacial':w.enemy,w.enemySkin","p.world==='space'?'Patrulha espacial':spawn.name||w.enemy,spawn.skin||w.enemySkin");s=s.replace('{ecologyKey,dead:',"{rank:spawn.rank,siteType:spawn.siteType,formation:spawn.formation,ai:{...Tactics.identity(spawn.skin||w.enemySkin,index,p.world),...(p.world==='space'?{}:Tactics.ROLES[spawn.role]),rank:spawn.rank,reactionDelay:spawn.rank==='elite'?.22:spawn.rank==='veteran'?.35:.55},ecologyKey,dead:");fs.writeFileSync(q,s);
q='public/world-kit.js';s=fs.readFileSync(q,'utf8').replace("clock=Art.reduceMotion?0:t;if(o.kind==='tree')","clock=Art.reduceMotion?0:t;if(o.kind==='prop')return sprite(c,'furniture',o.sprite,o.x,o.y,o.size);if(o.kind==='tree')").replace('for(const home of entry.houses){','for(const home of entry.houses.filter(h=>h.kind!=="prop")){');fs.writeFileSync(q,s);
q='public/sandbox-ui.js';s=fs.readFileSync(q,'utf8').replace('String(selectedItem===key)','String(!!key&&selectedItem===key)');fs.writeFileSync(q,s);
console.log('Composições, tropas e slots atualizados.');
