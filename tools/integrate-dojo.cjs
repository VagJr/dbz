const fs=require('fs');const edit=(f,fn)=>{let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');const put=(a,b)=>{if(!s.includes(a))throw Error(f+' missing '+a.slice(0,60));s=s.replace(a,b)};fn(put);fs.writeFileSync(f,s)};
edit('src/combat-flow.js',p=>{p("b.counterReadyUntil=this.time+.9;", "b.counterReadyUntil=this.time+.9;b.nextOpening=Math.min(b.nextOpening||0,this.time+.12);");p("b.state==='recover'", "['recover','breathe'].includes(b.state)");});
edit('src/engine.js',p=>{
 p('            p.world === e.world &&','            (!e.practiceOwner || e.practiceOwner===p.id) && p.world === e.world &&');
 p('  damage(attacker, target, amount, heavy = false) {',`  damage(attacker, target, amount, heavy = false) {
    if(target.practiceOwner&&attacker.id!==target.practiceOwner || attacker.practiceOwner&&target.id!==attacker.practiceOwner)return;
    if(attacker.practiceOwner)amount=Math.min(amount,Math.max(0,target.hp-1));`);
 p('    target.respawnAt = t + 18;','    target.respawnAt = t + 18;\n    if(target.practiceOwner)return;');
});
edit('src/beta.js',p=>{
 p(" if(data.action==='claim')",` if(data.action==='sparringEnd'){for(const e of this.enemies)if(e.practiceOwner===id)e.dead=true;p.sparring=null;return{ok:true,message:'Treino encerrado.'};}
 if(data.action==='sparring'){
  const ai=T.ROLES[data.role],mentor=this.maps[p.world]?.mentor,rank=['regular','veteran','elite'].includes(data.rank)?data.rank:'regular';
  if(!ai||!mentor||p.world==='space'||p.mode!=='ground'||Math.hypot(p.x-mentor.x,p.y-mentor.y)>280)return bad('Pouse junto ao mestre do planeta para iniciar o treino.');
  if(p.state==='dead'||p.hp<2||p.training||p.expedition||this.time-p.lastHit<5)return bad('Recupere-se e encerre a atividade atual primeiro.');
  if(this.enemies.some(e=>!e.dead&&!e.practiceOwner&&e.world===p.world&&Math.hypot(e.x-p.x,e.y-p.y)<650))return bad('Afaste ameaças reais antes de treinar.');
  for(const e of this.enemies)if(e.practiceOwner===id)e.dead=true;
  const skin={scout:'soldier',brawler:'demon',duelist:'vegeta',skirmisher:'android',artillery:'frieza',juggernaut:'jiren'}[data.role];
  const e=this.spawn(p.world,'Sparring · '+data.role,skin,p.x+240,p.y,false,{hp:500,maxHp:500,damage:rank==='elite'?18:rank==='veteran'?12:7,rank,level:1,ai:{...ai,aggroRange:800},practiceOwner:id,nonRespawn:true,rewardXP:0,cooldown:this.time+2});
  p.sparring={enemyId:e.id,ends:this.time+180,world:p.world,x:p.x,y:p.y};p.targetId=e.id;
  return{ok:true,message:'Treino de três minutos. Não concede XP ou itens; o rival interrompe antes de nocautear você.'};
 }
 if(data.action==='claim')`);
 p("tick.call(this,dt);for(const p",`tick.call(this,dt);
 for(const p of this.players.values())if(p.sparring){const run=p.sparring,e=this.enemies.find(e=>e.id===run.enemyId);if(!e||e.dead||p.hp<=1||p.world!==run.world||Math.hypot(p.x-run.x,p.y-run.y)>700||this.time>=run.ends){if(e)e.dead=true;p.sparring=null;this.emit('notice',p,{text:'Treino encerrado. Observe seu ritmo e tente outra identidade.',playerId:p.id});}}
 this.enemies=this.enemies.filter(e=>!e.practiceOwner||!e.dead&&this.players.has(e.practiceOwner));
 for(const p`);
 p("s.beta={version:B.version,", "s.beta={sparring:p.sparring?{enemyId:p.sparring.enemyId,seconds:Math.max(0,Math.ceil(p.sparring.ends-this.time))}:null,version:B.version,");
});
edit('public/beta-ui.js',p=>{
 p("expeditions:'Expedições',", "expeditions:'Expedições',combat:'Dojo',");
 p(" if(tab==='collection'){",` if(tab==='combat'){
  section('Encontre seu ritmo','Pouse junto a um mestre. Escolha a identidade do rival, pratique por três minutos e acompanhe sua sessão. Não há recompensa econômica nem perda de personagem no sparring.');
  const rank=node('select');rank.setAttribute('aria-label','Experiência do rival');for(const[id,label]of [['regular','Aprendiz · reação 420 ms'],['veteran','Veterano · reação 300 ms'],['elite','Elite · reação 240 ms']])rank.append(new Option(label,id));body.append(rank);
  const grid=node('div',null,'beta-card-grid');body.append(grid);
  for(const[id,name,skin,text]of [['scout','Batedor','soldier','Pressiona e sai pela lateral. Leia a aproximação.'],['brawler','Lutador','piccolo','Prefere contato e pressão. Ataque durante a recuperação.'],['duelist','Duelista','vegeta','Defende, esquiva e devolve golpes bloqueados. Varie sua sequência.'],['skirmisher','Escaramuça','android','Alterna distância e contato; recua quando cercado.'],['artillery','Artilharia','frieza','Mantém distância. Flanqueie ou devolva seu disparo.'],['juggernaut','Colosso','jiren','Guarda forte e ondas lentas. Quebre a postura ou saia da área.']])card(grid,name,text,'/assets/portraits/'+({soldier:'goku',android:'cell',jiren:'vegeta'})[skin]+'.png',()=>request('beta',{action:'sparring',role:id,rank:rank.value},r=>{if(r?.ok)dialog.close();}),'Treinar '+name);
  // Portraits share the existing high resolution collection.
  const pictures=['goku','piccolo','vegeta','cell','frieza','vegeta'];[...grid.querySelectorAll('img')].forEach((im,i)=>im.src='/assets/portraits/'+pictures[i]+'.png');
  body.append(btn('Encerrar sparring',()=>request('beta',{action:'sparringEnd'})));
  section('Quatro respostas, os mesmos controles','Golpe ×3 lança; Esquiva persegue por 22 ki. Golpe ×2 e Técnica rápida produz Ruptura de ki (+6 ki) contra a guarda. Segurar Golpe produz um ataque pesado. Defesa nos primeiros 180 ms devolve projéteis. Um ataque que atravessa sua esquiva ativa abre 550 ms de contra-ataque.');
  section('Leia os sinais','Vermelho: ameaça anunciada. Dourado: contra-ataque. Verde: recuperação vulnerável (+20%). A barra azul sob o inimigo mostra energia de ações; espere o fôlego baixar ou pressione a guarda.');
 }
 if(tab==='collection'){`);
 // Avoid assigning a nonexistent intermediate image URL.
 p("'/assets/portraits/'+({soldier:'goku',android:'cell',jiren:'vegeta'})[skin]+'.png'","'/assets/portraits/'+({soldier:'goku',android:'cell',jiren:'vegeta'}[skin]||skin)+'.png'");
 p("['collection','expeditions'].includes(tab)","['collection','expeditions'].includes(tab)");
});
edit('tools/check-beta.cjs',p=>{p("['journey','expeditions','collection','community','account','release']","['journey','expeditions','combat','collection','community','account','release']");p('tabs:6','tabs:7');});
