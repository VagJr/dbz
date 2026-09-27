"use strict";
const Content = require("../shared/expansion");
const Tactics = require("./enemy-tactics");
const { getWorld } = require("../shared/content");

const byQuest = Object.fromEntries(Content.sideQuests.map(q => [q.id, q]));
const byNpc = Object.fromEntries(Content.npcs.map(n => [n.id, n]));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const near = (a, b, radius) => a.world === b.world && Math.hypot(a.x - b.x, a.y - b.y) <= radius;
const landmark = id => Content.landmarkById[id];
const questSummary = p => {
  const s = p.sideState, q = byQuest[s.active];
  if (!q) return null;
  return { id:q.id,title:q.title,kind:q.kind,progress:s.progress,required:q.count || q.seconds || 1,
    world:q.world,targetX:landmark(q.target)?.x,targetY:landmark(q.target)?.y };
};
function safeState(data) {
  const saved = data && typeof data === "object" ? data : {};
  const active = byQuest[saved.active] ? saved.active : null;
  return {
    active,
    progress:clamp(Math.floor(Number(saved.progress) || 0),0,999),
    hold:0,
    completed:Array.isArray(saved.completed) ? [...new Set(saved.completed.filter(id=>byQuest[id]))].slice(0,50) : [],
    collected:Array.isArray(saved.collected) ? [...new Set(saved.collected.filter(id=>Content.pickupSites.some(site=>site.id===id)))].slice(0,30) : [],
    escort:null,
    repeatCount:clamp(Math.floor(Number(saved.repeatCount)||0),0,100000)
  };
}

module.exports = Engine => {
  const add = Engine.prototype.addPlayer, profile = Engine.prototype.profile,
    snapshot = Engine.prototype.snapshot, interact = Engine.prototype.interact,
    damage = Engine.prototype.damage, act = Engine.prototype.act,
    tick = Engine.prototype.tick;

  Engine.prototype.addPlayer = function(id, data = {}) {
    const p = add.call(this,id,data);
    p.inventory = Object.fromEntries(Object.entries(data.inventory || {})
      .filter(([item,count])=>Content.items[item] && Number.isFinite(count) && count>0)
      .map(([item,count])=>[item,clamp(Math.floor(count),0,Content.items[item].max || 1)]));
    p.equipment = Content.items[data.equipment]?.kind==="gear" && p.inventory[data.equipment] ? data.equipment : null;
    p.selectedForm = Content.forms.some(f=>f.id===data.selectedForm && f.origin===p.origin) ? data.selectedForm : null;
    p.formId = null; p.formMultiplier = 1;
    p.sideState = safeState(data.sideState);
    p.discoveries = Array.isArray(data.discoveries) ? [...new Set(data.discoveries.filter(id=>Content.landmarkById[id]))].slice(0,100) : [];
    p.worldBossWins = clamp(Math.floor(Number(data.worldBossWins)||0),0,100000);
    return p;
  };
  Engine.prototype.profile = function(p) {
    return {...profile.call(this,p),inventory:{...p.inventory},equipment:p.equipment,
      selectedForm:p.selectedForm,sideState:{active:p.sideState.active,progress:p.sideState.progress,
        completed:[...p.sideState.completed],collected:[...p.sideState.collected],repeatCount:p.sideState.repeatCount},
      discoveries:[...p.discoveries],worldBossWins:p.worldBossWins};
  };
  Engine.prototype.snapshot = function(id) {
    const s = snapshot.call(this,id);
    if(!s) return s;
    const p = this.players.get(id);
    s.self.inventory = {...p.inventory};
    s.self.equipment = p.equipment;
    s.self.selectedForm = p.selectedForm;
    s.self.formId = p.formId;
    s.self.unlockedForms = Content.forms.filter(f=>f.origin===p.origin && this.formUnlocked(p,f)).map(f=>f.id);
    s.self.sideQuest = questSummary(p);
    s.self.sideCompleted = [...p.sideState.completed];
    s.self.discoveries = [...p.discoveries];
    s.self.worldBossWins = p.worldBossWins;
    s.self.rankScore = p.kills*5 + p.worldBossWins*100 + p.discoveries.length*15 + p.sideState.completed.length*40;
    s.npcs = Content.npcs.filter(n=>near(p,landmark(n.landmark),1450))
      .map(n=>({id:"npc:"+n.id,name:n.name,skin:n.skin,role:n.role,world:p.world,
        x:landmark(n.landmark).x,y:landmark(n.landmark).y,state:"idle",angle:-Math.PI/2}));
    s.landmarks = Content.landmarks.filter(l=>near(p,l,1700)).map(l=>({
      id:l.id,name:l.name,kind:l.kind,x:l.x,y:l.y,world:l.world,discovered:p.discoveries.includes(l.id)}));
    s.pickups = Content.pickupSites.filter(site=>site.world===p.world &&
      Math.hypot(site.x-p.x,site.y-p.y)<1450 && !p.sideState.collected.includes(site.id));
    s.escort = p.sideState.escort ? {...p.sideState.escort,world:p.world,name:"Dende",skin:"dende",state:"run",angle:0,id:"side-escort"} : null;
    return s;
  };
  Engine.prototype.formUnlocked = function(p,form) {
    if(form.origin!==p.origin || p.level<form.level) return false;
    if(form.requires==="divine" && !p.lore?.done?.includes("whis") && !p.techniques?.includes("divine")) return false;
    return true;
  };
  Engine.prototype.formDefinition = function(p) {
    const unlocked = Content.forms.filter(f=>this.formUnlocked(p,f));
    return unlocked.find(f=>f.id===p.selectedForm) || unlocked.at(-1) || null;
  };
  Engine.prototype.selectForm = function(id,formId) {
    const p=this.players.get(id),form=Content.forms.find(f=>f.id===formId);
    if(!p || !form || !this.formUnlocked(p,form)) return "Forma indisponível. Avance no nível e no treinamento.";
    p.selectedForm=form.id;
    return form.name+" preparada para o próximo Despertar.";
  };
  Engine.prototype.giveItem = function(p,itemId,count=1) {
    const item=Content.items[itemId];
    if(!item)return false;
    p.inventory[itemId]=clamp((p.inventory[itemId]||0)+count,0,item.max||1);
    return true;
  };
  Engine.prototype.itemAction = function(id,itemId) {
    const p=this.players.get(id),item=Content.items[itemId];
    if(!p || !item || !p.inventory[itemId] || p.state==="dead")return "Item indisponível.";
    if(item.kind==="gear"){
      p.equipment=p.equipment===itemId?null:itemId;
      return p.equipment ? item.name+" equipado." : item.name+" removido.";
    }
    if(itemId==="senzu"){
      if(p.hp>=p.maxHp && p.ki>=100)return "Suas forças já estão completas.";
      p.hp=p.maxHp;p.ki=100;
    }else if(itemId==="capsule"){
      if(p.hp>=p.maxHp)return "HP já está completo.";
      p.hp=Math.min(p.maxHp,p.hp+p.maxHp*0.45);
    }
    p.inventory[itemId]--;
    if(!p.inventory[itemId])delete p.inventory[itemId];
    this.emit("heal",p,{text:item.name.toUpperCase()});
    return item.name+" utilizada.";
  };
  Engine.prototype.buyItem = function(id,itemId) {
    const p=this.players.get(id),item=Content.items[itemId],
      bulma=byNpc.bulma,marker=landmark(bulma.landmark);
    const prices={senzu:130,capsule:70,scouter:220,weightedGi:260,kiFocus:340,pulseGloves:400};
    if(!p || !item || !near(p,marker,180) || p.state==="dead")return "Encontre Bulma na Capsule Corporation.";
    const price=prices[itemId];
    if(!price || p.zenni<price)return "Zenni insuficientes.";
    if(item.kind==="gear" && p.inventory[itemId])return "Você já possui este equipamento.";
    p.zenni-=price;this.giveItem(p,itemId);
    return item.name+" adquirida por "+price+" zenni.";
  };
  Engine.prototype.sideQuest = function(id,questId) {
    const p=this.players.get(id),q=byQuest[questId],giver=byNpc[q?.giver],marker=landmark(giver?.landmark);
    if(!p || !q || !giver || !marker)return "Missão desconhecida.";
    if(p.sideState.active)return "Conclua a missão secundária atual primeiro.";
    if(p.level<q.level)return "Treine até o nível "+q.level+" para aceitar esta missão.";
    if(!near(p,marker,230))return "Encontre "+giver.name+" para aceitar a missão.";
    if(p.sideState.completed.includes(q.id) && !q.repeatable)return "Missão já concluída.";
    p.sideState.active=q.id;p.sideState.progress=0;p.sideState.hold=0;p.sideState.collected=[];
    p.sideState.escort=q.kind==="escort"?{x:marker.x,y:marker.y}:null;
    this.emit("complete",p,{text:"MISSÃO SECUNDÁRIA · "+q.title,playerId:p.id});
    return q.title+" iniciada.";
  };
  Engine.prototype.sideProgress = function(p,count=1) {
    const s=p.sideState,q=byQuest[s.active];if(!q)return false;
    const required=q.count || q.seconds || 1;
    s.progress=clamp(s.progress+count,0,required);
    if(s.progress<required)return true;
    if(!q.repeatable && !s.completed.includes(q.id))s.completed.push(q.id);
    if(q.repeatable)s.repeatCount++;
    this.reward(p,q.rewards.xp);
    p.zenni+=q.rewards.zenni;
    this.giveItem(p,q.rewards.item);
    this.emit("complete",p,{text:"MISSÃO CONCLUÍDA · "+q.title,playerId:p.id});
    s.active=null;s.progress=0;s.hold=0;s.escort=null;
    return true;
  };
  Engine.prototype.sideInteract = function(p) {
    const q=byQuest[p.sideState.active];
    if(q?.kind==="collect"){
      const pickup=Content.pickupSites.find(site=>site.item===q.target && !p.sideState.collected.includes(site.id) &&
        site.world===p.world && Math.hypot(site.x-p.x,site.y-p.y)<115);
      if(pickup){
        p.sideState.collected.push(pickup.id);
        this.sideProgress(p);
        return "Cápsula encontrada. "+(p.sideState.active ? p.sideState.progress+"/"+q.count : "Missão concluída.");
      }
    }
    const npc=Content.npcs.find(n=>near(p,landmark(n.landmark),165));
    if(!npc)return null;
    const options=npc.quests.filter(id=>byQuest[id] && !p.sideState.completed.includes(id));
    return npc.name+": "+npc.dialogue+(options.length?" Missões: "+options.map(id=>byQuest[id].title).join(", ")+".":"");
  };
  Engine.prototype.interact = function(id) {
    const p=this.players.get(id);
    if(p){
      const story=this.storyInteract(p);
      if(story)return story;
      const side=this.sideInteract(p);
      if(side)return side;
    }
    return interact.call(this,id);
  };
  Engine.prototype.act = function(id,name) {
    const p=this.players.get(id);
    const before=p?.training?.hits || 0;
    const result=act.call(this,id,name);
    if(p && name==="attack" && p.training?.hits>before && byQuest[p.sideState.active]?.kind==="train")
      this.sideProgress(p,1);
    return result;
  };
  Engine.prototype.damage = function(attacker,target,amount,heavy=false) {
    const alive=target && !target.dead && target.hp>0;
    damage.call(this,attacker,target,amount,heavy);
    if(!alive || !target?.dead || !this.players.has(attacker?.id))return;
    const p=attacker,q=byQuest[p.sideState.active];
    if(q?.kind==="hunt" && p.world===q.world && target.family===q.family)
      this.sideProgress(p);
    if(target.event && target.worldEventId){
      p.worldBossWins++;
      this.giveItem(p,p.worldBossWins%3===0?"kiFocus":"senzu");
      this.emit("complete",p,{text:"WORLD BOSS DERROTADO · "+target.name,playerId:p.id});
    }else if(!target.storyEncounter && target.ecologyKey){
      const roll=(this.serial*17+target.id.length*31+p.kills*13)%13;
      if(roll===0)this.giveItem(p,"capsule");
      else if(roll===1 && target.level>=5)this.giveItem(p,"senzu");
    }
  };
  Engine.prototype.tick = function(dt=1/30) {
    tick.call(this,dt);
    for(const p of this.players.values()){
      if(p.form && p.formId){
        const form=Content.forms.find(f=>f.id===p.formId);
        if(form?.kiDrain){
          p.ki=Math.max(0,p.ki-form.kiDrain*dt);
          if(!p.ki){p.form=false;p.formId=null;p.formMultiplier=1;}
        }
      }else if(p.formId){p.formId=null;p.formMultiplier=1;}
      const q=byQuest[p.sideState.active];
      if(!q || p.state==="dead")continue;
      const goal=landmark(q.target);
      if(q.kind==="visit" && goal && near(p,goal,180))this.sideProgress(p);
      if(q.kind==="defend" && goal){
        if(near(p,goal,280) && this.time-p.lastHit>1.5 && !this.enemies.some(e=>!e.dead && e.world===p.world && Math.hypot(e.x-goal.x,e.y-goal.y)<180)){
          p.sideState.hold+=dt;
          p.sideState.progress=Math.floor(p.sideState.hold);
          if(p.sideState.hold>=q.seconds)this.sideProgress(p,q.seconds);
        }else p.sideState.hold=0;
      }
      if(q.kind==="escort" && p.sideState.escort && goal){
        const guide=p.sideState.escort;
        const from=landmark(byNpc[q.giver].landmark);
        const distance=Math.hypot(goal.x-guide.x,goal.y-guide.y);
        if(p.world===q.world && Math.hypot(p.x-guide.x,p.y-guide.y)<230 && distance>100){
          const step=Math.min(distance,110*dt);
          guide.x+=(goal.x-guide.x)/distance*step;
          guide.y+=(goal.y-guide.y)/distance*step;
          p.sideState.progress=clamp(Math.floor((1-distance/Math.hypot(goal.x-from.x,goal.y-from.y))*100),0,99);
        }
        if(distance<=100 && near(p,goal,240))this.sideProgress(p);
      }
    }
    if(this.event && !this.event.episode){
      const enemy=this.enemies.find(e=>e.id===this.event.id),def=Content.worldEvents[this.event.world] || Content.worldEvents.default;
      if(enemy){
        const host=[...this.players.values()].find(p=>p.world===enemy.world);
        enemy.name=def.name;enemy.skin=def.skin;enemy.level=def.level;enemy.hp=enemy.maxHp=Math.max(950,def.level*115);
        enemy.ai=Tactics.identity(def.skin,this.serial,enemy.world);
        enemy.combatStyle=def.style;enemy.worldEventId=def.id;
        if(host){enemy.x=host.x+460;enemy.y=host.y+230;enemy.homeX=enemy.x;enemy.homeY=enemy.y;}
        this.event.episode=def.id;this.event.title=def.title;this.event.x=enemy.x;this.event.y=enemy.y;
      }
    }
    for(const p of this.players.values()){
      for(const site of Content.landmarks){
        if(site.world!==p.world || p.discoveries.includes(site.id) || !near(p,site,110))continue;
        p.discoveries.push(site.id);
        this.reward(p,35);
        this.emit("complete",p,{text:"LOCAL DESCOBERTO · "+site.name,playerId:p.id});
      }
    }
  };
};