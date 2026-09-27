(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./content'));else root.UZOpenWorld=factory(root.UZ);})(typeof globalThis!=='undefined'?globalThis:this,function(UZ){
  const CHUNK=1600;
  const earth=[['Montanhas Paozu',1700,1740,1],['Cidade do Oeste',10200,3400,5],['Deserto de Yamcha',-7200,6300,9],['Território da Red Ribbon',6200,-9800,14],['Torre Karin',-12000,-6200,20],['Terras do torneio',14200,13500,28]];
  function regions(id){return id==='earth'?earth.map(([name,x,y,level])=>({name,x,y,level})):Array.from({length:6},(_,i)=>({name:`${UZ.getWorld(id).region} · região ${i+1}`,x:1700+Math.cos(i*2.4)*i*4500,y:1740+Math.sin(i*2.4)*i*4500,level:1+Math.max(0,UZ.WORLDS.findIndex(w=>w.id===id))*3+i*5}));}
  function hash(id,x,y){let h=UZ.getWorld(id).seed|0;h=Math.imul(h^x,374761393);h=Math.imul(h^y,668265263);return (h^(h>>>13))>>>0;}
  function region(id,x,y){const entries=regions(id);let best=entries[0],dist=Infinity;for(const r of entries){const d=Math.hypot(x-r.x,y-r.y);if(d<dist){dist=d;best=r;}}return {...best,level:best.level+Math.floor(Math.max(0,dist-4000)/5000),frontier:dist>9000};}
  function chunk(id,cx,cy){
    const random=UZ.rng(hash(id,cx,cy)),x=cx*CHUNK,y=cy*CHUNK,r=region(id,x+800,y+800);
    const biomes=id==='namek'?['namek','namek','plateau']:id==='earth'?['grass','forest','desert','plateau']:['plateau','desert','forest'];
    const biome=id==='earth'?(r.name.includes('Deserto')?'desert':r.name.includes('Paozu')||r.name.includes('Red Ribbon')?'forest':'grass'):id==='namek'?'namek':biomes[Math.floor(random()*biomes.length)];
    const objects=Array.from({length:biome==='forest'?95:48},()=>({x:x+random()*CHUNK,y:y+random()*CHUNK,size:12+random()*33,kind:random()<.68&&biome!=='desert'?'tree':'rock'})).filter(o=>Math.hypot(o.x-1700,o.y-1740)>360);
    const site={x:x+400+random()*800,y:y+400+random()*800,type:random()<.45?'camp':'ruin'};
    const enemies=Array.from({length:4},(_,i)=>({x:site.x+Math.cos(i*1.57)*170,y:site.y+Math.sin(i*1.57)*170,level:r.level+i%2,mode:id==='space'||i===3?'flight':'ground'}));
    return {key:`${id}:${cx}:${cy}`,x,y,biome,objects,site,enemies,region:r};
  }
  function features(id,cx,cy){
    const ch=chunk(id,cx,cy),rand=UZ.rng(hash(id,cx,cy)^7813),out=[];
    const river=y=>4100+Math.sin(y/1700)*1100+Math.sin(y/620)*180;
    for(let i=0;i<7;i++){const x=ch.x+rand()*CHUNK,y=ch.y+rand()*CHUNK,r=85+rand()*100;
      if(Math.hypot(x-1700,y-1740)>650&&Math.hypot(x-ch.site.x,y-ch.site.y)>330&&Math.abs(x-river(y))>r+170){rand();rand();if(id==='earth')rand();out.push({x,y,radius:r,kind:'mountain'});}}
    for(let i=0;i<6;i++){const a=i*2.399,x=ch.site.x+Math.cos(a)*(90+i*20),y=ch.site.y+Math.sin(a)*(90+i*20);if(Math.abs(x-river(y))>160)out.push({x,y,radius:35+rand()*20,kind:'house'});}
    for(const o of ch.objects)out.push({...o,radius:o.size});
    return out.map(o=>({...o,id:id+':'+o.kind+':'+Math.round(o.x)+':'+Math.round(o.y)}));
  }
  return {CHUNK,regions,region,chunk,hash,features};
});
