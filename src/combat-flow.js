'use strict';
const W=require('../shared/open-world');
module.exports=Engine=>{
 const act=Engine.prototype.act,target=Engine.prototype.target,tick=Engine.prototype.tick,damage=Engine.prototype.damage,snapshot=Engine.prototype.snapshot;
 Engine.prototype.target=function(p,range){const selected=this.enemies.find(e=>e.id===p.targetId&&!e.dead&&e.world===p.world&&Math.hypot(e.x-p.x,e.y-p.y)<range);return selected||target.call(this,p,range);};
 Engine.prototype.act=function(id,name){const p=this.players.get(id);if(!p)return false;
  if(name==='blast'&&p.cooldowns.blast>this.time)p.chargeAt=null;
  if(name==='cancelCharge'){p.meleeAt=null;p.queuedAttack=null;}
  if(name==='cycleTarget'||name.startsWith('target:')){const list=this.enemies.filter(e=>!e.dead&&e.world===p.world&&Math.hypot(e.x-p.x,e.y-p.y)<1000).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));const next=name==='cycleTarget'?list[(list.findIndex(e=>e.id===p.targetId)+1)%list.length]:list.find(e=>e.id===name.slice(7));p.targetId=next?.id||null;return !!next;}
  if(p.state==='dead'||p.stun>this.time){p.meleeAt=null;p.queuedAttack=null;return false;}
  if(name==='attackStart'){if(p.meleeAt!=null)return false;p.meleeAt=this.time;name='attack';}
  if(name==='attackRelease'){const held=p.meleeAt==null?0:this.time-p.meleeAt;p.meleeAt=null;if(held<.5)return false;if(p.ki<18)return false;p.queuedAttack={until:this.time+.3,heavy:true};return true;}
  if(name==='attack'&&!p.training&&p.cooldowns.attack>this.time){if(p.cooldowns.attack-this.time<.24)p.queuedAttack={until:this.time+.26,heavy:false};return false;}
  if(name==='dash'||name==='blastStart'){p.queuedAttack=null;p.meleeAt=null;}
  return act.call(this,id,name);
 };
 Engine.prototype.damage=function(a,b,amount,heavy=false){const hp=b.hp;
  if(!this.players.has(b.id)&&b.state==='guard'){
    const facing=Math.cos(Math.atan2(a.y-b.y,a.x-b.x)-b.angle)>.17;
    if(facing){b.guardMeter=(b.guardMeter??70)-(heavy?45:15);if(b.guardMeter>0)amount*=.2;else{b.state='stun';b.stun=this.time+.8;b.guardBrokenUntil=this.time+6;this.emit('break',b,{text:'GUARDA QUEBRADA'});}}
  }
  damage.call(this,a,b,amount,heavy);if(b.hp>=hp)return;
  const guard=b.state==='guard'&&b.ki>0;if(guard)return;
  const tier=heavy?(amount>=70||a.heavyStrike?'high':'mid'):'low',speed=tier==='high'?1900:tier==='mid'?950:160;
  const angle=Math.atan2(b.y-a.y,b.x-a.x);b.launch={x:Math.cos(angle)*speed,y:Math.sin(angle)*speed,left:tier==='high'?.36:.18,tier};
  this.emit('impact',b,{angle,tier,heavy});
  if(tier==='high'&&b.world!=='space')this.impactTerrain(b,tier);
 };
 Engine.prototype.tick=function(dt=1/30){
  const charged=this.shots.filter(s=>s.pierce&&s.life<=dt);
  tick.call(this,dt);
  for(const shot of charged)if(shot.world!=='space'){this.impactTerrain(shot,'high');this.emit('impact',shot,{heavy:true,tier:'high'});}
  for(const e of this.enemies)if((e.boss||e.level>=6)&&!e.dead&&e.stun<=this.time&&(e.guardBrokenUntil||0)<this.time&&['idle','run','guard'].includes(e.state)&&this.time%8<1.1){e.state='guard';e.guardMeter??=70;}
  for(const p of this.players.values()){
   if(p.queuedAttack){const q=p.queuedAttack;if(this.time>q.until||p.stun>this.time||p.state==='dead'||p.input.guard){p.queuedAttack=null;continue;}
    if(p.cooldowns.attack<=this.time){p.queuedAttack=null;p.heavyStrike=q.heavy&&p.ki>=18;if(p.heavyStrike)p.ki-=18;act.call(this,p.id,'attack');p.heavyStrike=false;}
   }
  }
  for(const e of [...this.players.values(),...this.enemies]){
   if(!e.launch)continue;const l=e.launch,steps=Math.max(1,Math.ceil(Math.hypot(l.x,l.y)*dt/35));
   for(let i=0;i<steps;i++){this.move(e,l.x*dt/steps,l.y*dt/steps);if(l.tier!=='low'&&e.world!=='space')this.impactTerrain(e,l.tier);}
   l.left-=dt;l.x*=Math.exp(-dt*4);l.y*=Math.exp(-dt*4);e.stun=Math.max(e.stun,this.time+.04);if(l.left<=0)e.launch=null;
  }
 };
 Engine.prototype.impactTerrain=function(e,tier){this.worldMemory??={};const cx=Math.floor(e.x/W.CHUNK),cy=Math.floor(e.y/W.CHUNK);
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const o of W.features(e.world,cx+dx,cy+dy)){
   if(o.kind==='mountain'&&tier!=='high')continue;
   if(Math.hypot(o.x-e.x,(o.y-e.y)*1.4)>o.radius+18)continue;
   const key='debris:'+o.id;if(this.worldMemory[key])continue;
   this.worldMemory[key]={world:e.world,x:o.x,y:o.y,radius:o.radius,kind:o.kind};this.emit('break',{world:e.world,x:o.x,y:o.y},{text:'IMPACTO',heavy:true});
  }
 };
 Engine.prototype.snapshot=function(id){const s=snapshot.call(this,id);if(!s)return s;s.self.targetId=this.players.get(id).targetId;s.self.meleeCharge=Math.max(0,this.time-(this.players.get(id).meleeAt??this.time));s.self.debris=Object.entries(this.worldMemory||{}).filter(([k,o])=>k.startsWith('debris:')&&o.world===s.self.world&&Math.hypot(o.x-s.self.x,o.y-s.self.y)<2400).map(([id,o])=>({id:id.slice(7),...o}));return s;};
};
