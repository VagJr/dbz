const fs=require('fs');
function edit(file,fn){let s=fs.readFileSync(file,'utf8');fs.writeFileSync(file,fn(s));}
function sub(s,a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,90));return s.replace(a,b);}
edit('src/engine.js',s=>{
s=sub(s,'const n = Math.max(1, Math.hypot(x, y));','const n = Math.max(1, Math.hypot(x, y));\n    if (data.guard === true && !p.input.guard) {\n      p.guardPressedAt = this.time >= (p.nextPerfectGuard || 0) ? this.time : -99;\n      p.nextPerfectGuard = this.time + 0.6;\n    }');
s=sub(s,'if (p.state !== "guard") {p.guardAt=t>=(p.nextPerfectGuard||0)?t:-99;p.nextPerfectGuard=t+.6;}','if (p.state !== "guard") p.guardAt = p.guardPressedAt ?? -99;');
s=sub(s,'} else if (p.chargeAt !== null) {','} else if (p.meleeAt != null) {\n          p.state = "meleeCharge";\n        } else if (p.chargeAt !== null) {');
s=sub(s,'p.chargeAt = null;\n      }\n      this.navigationTick','p.chargeAt = null;\n        p.meleeAt = null;\n      }\n      this.navigationTick');
s=sub(s,'(e.practiceOwner && e.practiceOwner !== owner.id) ||','((owner.duelId || e.duelId) && owner.duelId !== e.duelId) ||\n          (e.practiceOwner && e.practiceOwner !== owner.id) ||');
s=sub(s,'projectile: true, kiWeave: !!s.weave','projectile: true, kiWeave: !!s.weave, attackData: { posture: s.posture || 15, stun: .2 }');
return s;});
edit('src/combat-rhythm.js',s=>{
s=sub(s,'if(b.dead||b.state===\'dead\'||b.invuln>this.time)return damage.call(this,a,b,amount,heavy);',`if(b.dead||b.state==='dead')return;
  if(b.invuln>this.time){if(this.players.has(b.id)&&b.state==='dash'&&(b.lastPerfectEvade??-10)+1<this.time){b.lastPerfectEvade=this.time;b.focus=Math.min(100,b.focus+8);b.counterUntil=this.time+.55;this.emit('parry',b,{text:'ESQUIVA PRECISA'});}return;}`);
s=sub(s,"p.comboConfirmed=0;this.emit('cast'", "p.comboConfirmed=0;if(!p.duelId)p.mastery[p.equipped]=Math.min(100,(p.mastery[p.equipped]||0)+1);this.emit('cast'");
const begin=s.indexOf('  for(const p of this.players.values()){',s.indexOf('  tick.call(this,dt);'));
const end=s.indexOf('\n };\n Engine.prototype.snapshot',begin);
s=s.slice(0,begin)+`  // Capture committed impacts before resolving any: simultaneous attacks can trade.
  const impacts=[...this.players.values()].flatMap(p=>{const m=p.moveAction;return m&&p.stun<=this.time&&p.state!=='dead'&&this.time>=m.impact&&this.time<m.activeEnd?[[p,m]]:[];});
  for(const [p,m] of impacts)this.resolveMove(p,m);
  for(const p of this.players.values()){
   const m=p.moveAction;if(!m)continue;
   if(p.stun>this.time||p.state==='dead'){p.moveAction=null;p.rhythmQueue=null;continue;}
   p.angle=m.angle;p.state=this.time<m.impact?'windup':this.time<m.activeEnd?'attack':'recover';
   if(this.time>=m.end){if(!m.hit&&!C.moves[m.key].speed)p.comboConfirmed=0;p.moveAction=null;p.state='idle';const q=p.rhythmQueue;p.rhythmQueue=null;if(q&&q.expires>=this.time)this.beginMove(p,q.action==='ki'?'ki':this.nextCombo(p));}
  }`+s.slice(end);
return s;});
edit('src/duels.js',s=>{
s=sub(s,"const savedKeys=", "const ready=(p,t)=>p&&!p.duelId&&!p.training&&!p.sparring&&!p.expedition&&!p.moveAction&&p.state!=='dead'&&p.mode==='ground'&&t-Math.max(p.lastHit??-99,p.lastCombatAt??-99)>5;\nconst savedKeys=");
s=sub(s,"p.launch=null;p.moveAction=null;", "p.counterUntil=0;p.guardAt=-99;p.guardPressedAt=-99;p.nextPerfectGuard=0;p.inputAt=this.time;p.until=0;p.queuedAttack=null;p.launch=null;p.moveAction=null;");
s=sub(s,"p.state='idle';p.targetId=null;", "p.state='idle';p.counterUntil=0;p.chargeAt=null;p.meleeAt=null;p.queuedAttack=null;p.invuln=0;p.until=0;p.input={x:0,y:0,angle:p.angle};p.targetId=null;");
s=sub(s,"const q=this.players.get(data.target);if(!q||q===p", "const q=this.players.get(data.target);if(!ready(p,this.time)||!ready(q,this.time)||q===p");
s=sub(s,"if(!q||invite.expires<this.time", "if(!ready(p,this.time)||!ready(q,this.time)||invite.expires<this.time");
s=sub(s,"this.duelBegin(q,p);", "if(this.enemies.some(e=>!e.dead&&e.world===p.world&&Math.min(Math.hypot(e.x-p.x,e.y-p.y),Math.hypot(e.x-q.x,e.y-q.y))<800))return bad('Há inimigos próximos. Procurem um local seguro.');this.duelBegin(q,p);");
s=sub(s,"if(b.hp<=0)this.duelRound(m,a.id,'Nocaute');", "");
s=sub(s,"const out=players.find", "if(players.some(p=>p.hp<=0)){const survivors=players.filter(p=>p.hp>0);this.duelRound(m,survivors.length===1?survivors[0].id:null,survivors.length?'Nocaute':'Nocaute simultâneo');continue;}\n const out=players.find");
return s;});
edit('server.js',s=>sub(s,'if (p && !limited("pvp", 1)', 'if (p && !p.duelId && !limited("pvp", 1)'));
edit('src/quests.js',s=>{s=sub(s,'cooldownUntil: this.time + 10','cooldownUntil: this.time + (enemy.storyQuestId === "db-paozu" ? 2 : 10)');return s.replace(/    if\(q.id==='db-paozu'&&prior\)\{[^\n]*\}\r?\n/,'');});
edit('public/app.js',s=>{
s=sub(s,'Vá até a marca dourada de Mestre Kame.','Siga o marcador dourado da sua história.');s=sub(s,'Aproxime-se do mestre e use Conversar (E). Ele recupera suas forças e inicia sua aventura.','Encontre Bulma no marcador dourado e use Conversar (E). A investigação abre sua aventura.');s=sub(s,'done: (p) => p.questPhase > 0','done: (p) => p.guide?.questId !== "db-paozu" || p.guide?.objectiveId === "pilaf-intel"');s=sub(s,'Perto do mestre, use Treinar (T). Pressione Golpe quando a marca alcançar o centro.','Investigue a pista indicada. O primeiro confronto vem depois; não há pressa.');s=sub(s,'done: (p) => p.training?.hits > 0','done: (p) => p.guide?.objectiveId === "pilaf-scouts" || p.guide?.questId !== "db-paozu"');s=sub(s,'Golpe encadeia três ataques. Após o terceiro, Esquiva persegue o alvo lançado por 22 ki. Segure Golpe para quebrar a guarda.','Solte Golpe para atacar e confirme o impacto antes de continuar. Segure por 450 ms para um pesado. Após o terceiro acerto, Esquiva persegue por 28 ki.');s=sub(s,'done: (p) => p.questKills > 0','done: (p) => p.guide?.questId !== "db-paozu" || p.guide?.progress > 0');s=sub(s,'Escolha uma nova campanha nas Crônicas.','Explore o mundo, pratique no Dojo ou escolha uma expedição na Central.');
const start=s.indexOf('    if (\n      lastPhase !== p.questPhase');
const end=s.indexOf('    renderer.combatTarget',start);
if(start<0||end<0)throw Error('progress anchor');
s=s.slice(0,start)+`    const goal=p.guide, progressKey=goal?[goal.questId,goal.objectiveId,goal.progress,goal.required].join(':'):[p.questPhase,p.questKills].join(':');
    if ($('quest-progress').dataset.progress!==progressKey) {
      $('quest-progress').replaceChildren();
      const required=goal?Math.min(12,goal.required||1):p.legacyCampaign?3:0;
      for(let i=0;i<required;i++){const dot=document.createElement('i');dot.className=(goal?goal.progress>i:p.questKills>i||p.questPhase===2)?'done':'';$('quest-progress').append(dot);}
      $('quest-progress').dataset.progress=progressKey;
    }
`+s.slice(end);return s;});
edit('tests/quests.test.js',s=>{const start=s.indexOf('  const wave =',s.indexOf('test("the Paozu patrol'));const end=s.indexOf('  assert.equal(player.storyState.questId',start);s=s.slice(0,start)+`  for(let i=0;i<3;i++){
    storyTick(game,player);
    const wave=game.enemies.filter(e=>e.storyEncounterKey==='db-paozu:objective:pilaf-scouts'&&!e.dead);
    assert.equal(wave.length,1,'one introductory opponent at a time');
    game.damage(player,wave[0],9999);
    game.time+=2.1;
  }
`+s.slice(end);
const start2=s.indexOf('  const wave =',s.indexOf('test("players on different story objectives'));const end2=s.indexOf('  assert.equal(player.storyState.questId',start2);s=s.slice(0,start2)+`  for(let i=0;i<3;i++){storyTick(game,player);const enemy=game.enemies.find(e=>e.storyEncounterKey==='db-paozu:objective:pilaf-scouts'&&!e.dead);assert.ok(enemy);game.damage(player,enemy,9999);game.time+=2.1;}
`+s.slice(end2);return s;});
