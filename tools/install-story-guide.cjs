const fs=require('fs');const edit=(f,fn)=>{let s=fs.readFileSync(f,'utf8');const put=(a,b)=>{if(!s.includes(a))throw Error(f+' missing '+a.slice(0,50));s=s.replace(a,b)};fn(put);fs.writeFileSync(f,s)};
edit('src/engine.js',p=>{p('require("./duels")(Engine);','require("./duels")(Engine);\nrequire("./story-guide")(Engine);');p('!p.duelId && (!e.practiceOwner','!(e.cell&&p.world===\'earth\'&&p.storyState?.questId===\'db-paozu\'&&e.provokedBy!==p.id) && !p.duelId && (!e.practiceOwner');});
edit('src/open-world.js',p=>{p('      const cx=Math.floor(p.x/World.CHUNK)',"      if(p.duelId||p.world==='earth'&&p.storyState?.questId==='db-paozu')continue;\n      const cx=Math.floor(p.x/World.CHUNK)");p('const hp=100+level*24;','const hp=190+level*30;');});
edit('src/quests.js',p=>{p('const radius = 170 + Math.floor(index / 6) * 75;','const radius = 240 + Math.floor(index / 6) * 75;');p('group.hp || 90 + (group.level || 1) * 18','group.hp || 170 + (group.level || 1) * 25');p('const enemies = encounter.enemies || [];',"const enemies = encounter.enemies || [];\n    if(q.id==='db-paozu'&&prior){const defeated=(prior.defeated||0)+prior.enemies.filter(e=>e.dead).length;if(defeated>=(o.required||1))return;prior.defeated=defeated;}" );p('n < Math.max(1, Math.min(10, Math.floor(group.count || 1)))','n < (q.id===\'db-paozu\'?1:Math.max(1, Math.min(10, Math.floor(group.count || 1))))');p('this.storyEncounterRuntime.set(key, { enemyIds: index, enemies: spawned, cooldownUntil: 0 });','this.storyEncounterRuntime.set(key, { enemyIds: index, enemies: spawned, defeated:prior?.defeated||0,cooldownUntil: 0 });');p('cooldownUntil: 0 });\n    this.storyNotify(p, "AMEAÇA', 'cooldownUntil: 0 });\n    for(const e of spawned)e.cooldown=this.time+(q.id===\'db-paozu\'?2:1);\n    this.storyNotify(p, "AMEAÇA');});
edit('public/app.js',p=>{
 let a='    $("quest-title").textContent = p.storyObjective?.title';
 p(a,'    $("quest-title").textContent = p.storyObjective?.title');
 p('    const map = renderer.data,\n      near =',"    const guide=p.guide,storyNear=guide?.interactable&&guide.world===p.world&&Number.isFinite(guide.targetX)&&Math.hypot(p.x-guide.targetX,p.y-guide.targetY)<=guide.radius;\n    const map = renderer.data,\n      near =");
 p('!(near || orb || wish)','!(storyNear || near || orb || wish)');
 p('$("interact-label").textContent = wish','$("interact-label").textContent = storyNear ? (guide.type===\'collect\'?\'Investigar pista\':\'Conversar com \'+guide.speaker) : wish');
 const oldStart='    if (type === "campaigns") {';
 p(oldStart,`    if (type === "campaigns") {
      body.append(el('p','A mesma história que orienta o mundo, os diálogos e seu marcador.','panel-intro'));
      const guide=p?.guide;if(guide){body.append(el('h3',guide.title),el('p',guide.objective),button('Marcar objetivo atual',()=>{if(guide.world!==p.world)socket.emit('route',guide.world);closePanel();}));}
      for(const ch of p?.storyJournal||[]){const row=el('div',undefined,'chapter-row'+(ch.status==='active'?' current':''));const copy=el('div');copy.append(el('strong',ch.title),el('p',ch.description),el('small',ch.saga+' · '+({completed:'Concluído',active:'Em andamento',locked:'A seguir'})[ch.status]));row.append(el('span',ch.status==='completed'?'✓':ch.status==='active'?'◆':'○','chapter-number'),copy);body.append(row);}
    }
    if (type === "legacy-campaigns") {`);
 p('    if(UZLore.sites.some',"    if(!p.legacyCampaign){socket.emit('interact');return;}\n    if(UZLore.sites.some");
 p('renderer.combatTarget=state.enemies.find(e=>e.id===p.targetId);','renderer.combatTarget=[...state.enemies,...state.players].find(e=>e.id===p.targetId);');
 p('state.enemies.find((e) => e.id === p.targetId && !e.dead)','[...state.enemies,...state.players].find((e) => e.id === p.targetId && !e.dead)');
 p("const hit=state.enemies.find", "const hit=[...state.enemies,...state.players.filter(p=>p.id!==state.self.id&&p.pvp)].find");
});
edit('public/combat-art.js',p=>{p('      if (me && me.chapter) {\n        const goal = me.questPhase === 2 ? map.arena : map.mentor;',"      if (me?.guide&&me.guide.world===me.world&&Number.isFinite(me.guide.targetX) || me?.legacyCampaign&&me.chapter) {\n        const goal = me.guide?{x:me.guide.targetX,y:me.guide.targetY}:me.questPhase === 2 ? map.arena : map.mentor;");p('      for (const e of enemies)\n        if (e.state === "windup")', '      for (const e of [...enemies,...(state?.players||[]).filter(p=>p.id!==me?.id&&p.combatAction)])\n        if (e.state === "windup")');});
edit('public/lore-art.js',p=>{p('  const q=p?.loreObjective;',`  const guide=p?.guide;if(guide&&guide.world===r.world&&Number.isFinite(guide.targetX)){
   const x=guide.targetX,y=guide.targetY;c.save();c.strokeStyle='#ffe0a0';c.lineWidth=3;c.setLineDash([8,7]);c.beginPath();c.ellipse(x,y,guide.radius||100,(guide.radius||100)*.65,0,0,TAU);c.stroke();c.setLineDash([]);
   if(guide.skin&&Art.fighter)Art.fighter(c,{x,y,skin:guide.skin,state:'idle',angle:1.57},t,1);
   c.fillStyle='#fff0bd';c.font='bold 13px sans-serif';c.textAlign='center';c.fillText(guide.speaker+' · '+(guide.interactable?'E / Interagir':'OBJETIVO'),x,y-65);c.restore();
  }
  if(p?.duel){c.save();c.strokeStyle='#8acfff';c.lineWidth=3;c.setLineDash([15,10]);c.beginPath();c.arc(p.duel.x,p.duel.y,p.duel.radius,0,TAU);c.stroke();c.restore();}
  const q=p?.loreObjective;`);});
