'use strict';
const Lore=require('../shared/lore');
const near=(p,s,r=150)=>p.world===s.world&&Math.hypot(p.x-s.x,p.y-s.y)<r;
module.exports=Engine=>{
 const move=Engine.prototype.move;
 Engine.prototype.move=function(p,dx,dy){const heavy=p.lore&&!p.lore.bubbles&&near(p,{world:'otherworld',x:16000,y:1740},300);return move.call(this,p,dx*(heavy?.65:1),dy*(heavy?.65:1));};
 const add=Engine.prototype.addPlayer,profile=Engine.prototype.profile,snapshot=Engine.prototype.snapshot,interact=Engine.prototype.interact,train=Engine.prototype.train,learn=Engine.prototype.learn,tick=Engine.prototype.tick,action=Engine.prototype.act,damage=Engine.prototype.damage;
 Engine.prototype.addPlayer=function(id,data={}){const p=add.call(this,id,data);p.lore={done:Array.isArray(data.lore?.done)?data.lore.done.filter(id=>Lore.sites.some(s=>s.id===id)):[],snake:Math.max(0,Math.min(Lore.snake.length,Math.floor(Number(data.lore?.snake)||0))),bubbles:!!data.lore?.bubbles};return p;};
 Engine.prototype.profile=function(p){return {...profile.call(this,p),lore:p.lore};};
 Engine.prototype.snapshot=function(id){const s=snapshot.call(this,id);if(s){s.self.lore=s.self.lore||this.players.get(id).lore;s.self.loreObjective=Lore.objective({...s.self,serverTime:this.time});s.self.loreTime=this.time;s.self.kaiokenUntil=this.players.get(id).kaiokenUntil||0;}return s;};
 Engine.prototype.loreGate=function(p,s){if(p.level<s.level)return `Treino disponível no nível ${s.level}.`;if(s.requires&&!p.lore.done.includes(s.requires))return `Conclua primeiro ${Lore.sites.find(x=>x.id===s.requires).name}.`;if(s.id==='kaio'&&p.lore.snake<Lore.snake.length)return 'Atravesse os marcos do Caminho da Serpente em ordem.';if(s.id==='kaio'&&!p.lore.bubbles)return 'Alcance Bubbles e use Interagir antes de treinar.';return null;};
 Engine.prototype.interact=function(id){const p=this.players.get(id);if(p&&p.state!=='dead'){
  const ch=this.chapter(p);if(ch?.boss==='Nappa'&&!p.lore.done.includes('kaio')&&near(p,{world:'earth',...this.maps.earth.mentor}))return 'Antes da invasão saiyajin, atravesse o Caminho da Serpente no Outro Mundo e conclua o treino do Senhor Kaio. Abra o atlas (M).';
  const kaio=Lore.sites.find(s=>s.id==='kaio'),b={world:'otherworld',x:kaio.x+Math.cos(this.time*.8)*150,y:kaio.y+Math.sin(this.time*.8)*110};
  if(p.lore.snake===Lore.snake.length&&!p.lore.bubbles&&near(p,b,65)){p.lore.bubbles=true;return 'Bubbles alcançado! Procure o Senhor Kaio no centro do planeta e use Treinar (T).';}
  const s=Lore.sites.find(s=>near(p,s));if(s)return p.lore.done.includes(s.id)?`${s.master}: seu treinamento foi concluído.`:this.loreGate(p,s)||`${s.master}: ${s.description} Use Treinar (T).`;
 }return interact.call(this,id);};
 Engine.prototype.train=function(id){const p=this.players.get(id),s=p&&Lore.sites.find(s=>near(p,s));if(!s)return train.call(this,id);if(p.state==='dead')return 'Aguarde para retornar.';const gate=this.loreGate(p,s);if(gate)return gate;if(p.lore.done.includes(s.id))return 'Treinamento concluído.';if(p.training)return 'Treino em andamento.';p.training={beat:this.time+1.4,hits:0,attempts:0,loreId:s.id};return `${s.master}: acerte 5 de 8 golpes no centro do indicador. Mover-se ou receber dano cancela o treino.`;};
 Engine.prototype.learn=function(id,tech){const p=this.players.get(id),s=Lore.sites.find(s=>s.reward===tech);if(s&&!p?.lore.done.includes(s.id))return `Aprenda esta técnica no treinamento de ${s.name}.`;return learn.call(this,id,tech);};
 Engine.prototype.finishLore=function(p,tr){if(!tr?.loreId||tr.attempts<8||tr.hits<5||p.lore.done.includes(tr.loreId))return;const s=Lore.sites.find(s=>s.id===tr.loreId);if(!near(p,s)||this.loreGate(p,s))return;p.lore.done.push(s.id);if(s.reward&&!p.techniques.includes(s.reward))p.techniques.push(s.reward);if(s.reward&&s.reward!=='teleport')p.equipped=s.reward;p.points+=s.id==='lookout'?2:1;this.reward(p,180);this.emit('transform',p,{text:s.id==='kaio'?'KAIOKEN [X] + GENKI DAMA':`TREINO CONCLUÍDO · ${s.name}`});};
 Engine.prototype.act=function(id,name){const p=this.players.get(id);if(name==='kaioken'){if(!p||p.state==='dead'||p.stun>this.time||!p.lore.done.includes('kaio')||p.ki<30||p.kaiokenCooldown>this.time)return false;p.ki-=30;p.kaiokenUntil=this.time+8;p.kaiokenCooldown=this.time+20;this.emit('transform',p,{text:'KAIOKEN ×2'});return true;}const tr=p?.training,result=action.call(this,id,name);if(p&&tr&&!p.training)this.finishLore(p,tr);return result;};
 Engine.prototype.damage=function(source,target,amount,...rest){return damage.call(this,source,target,amount*(source?.kaiokenUntil>this.time?2:1),...rest);};
 Engine.prototype.tick=function(dt=1/30){const sessions=[...this.players.values()].map(p=>[p,p.training]);tick.call(this,dt);for(const [p,tr] of sessions)if(tr&&!p.training)this.finishLore(p,tr);for(const p of this.players.values()){
  if(p.state==='dead')continue;
  if(p.world==='otherworld'&&p.lore.snake<Lore.snake.length){const q=Lore.snake[p.lore.snake];if(Math.hypot(p.x-q.x,p.y-q.y)<190){p.lore.snake++;this.emit('orb',p,{text:`CAMINHO DA SERPENTE ${p.lore.snake}/${Lore.snake.length}`});}}
  if(p.kaiokenUntil>this.time){p.ki=Math.max(0,p.ki-dt*3);if(p.ki===0)p.kaiokenUntil=0;}
 }};
};
