"use strict";
const Physics = require("../shared/physics");
const CollisionWorld = require("../shared/collision-world");
const Sandbox = require("../shared/sandbox");
const Wildlife = require("../shared/wildlife");
const CHUNK = require("../shared/open-world").CHUNK;
const fields = ["z", "vz", "groundZ", "grounded", "flightZ", "forcedFall", "landedAt", "landingSpeed", "jumpWindup"];
const cellKey = (e, size = CHUNK) => `${e.world}:${Math.floor(e.x / size)}:${Math.floor(e.y / size)}`;
function structureIndex(engine) {
  const structures = engine.worldMemory?.sandbox?.structures || [];
  if (engine.physicsStructures?.length === structures.length && engine.physicsStructures.expires > engine.time) return engine.physicsStructures.cells;
  const cells = new Map();
  for (const structure of structures) {
    const sprite = Sandbox.items[structure.kind]?.sprite;
    const metadata = sprite?.sheet === "furniture" ? { sheet: sprite.sheet, sprite: sprite.index } : {};
    const object = { ...structure, ...metadata, type: "structure" };
    const row = Math.floor((metadata.sprite ?? 0) / 14);
    object.size = row === 10 || ["camp", "gravity"].includes(structure.kind) ? 145 : 110;
    const colliders = CollisionWorld.collidersFor(object, structure.world).map(c => ({ ...c, world: structure.world }));
    const key = cellKey(structure), group = cells.get(key) || [];
    group.push(...colliders); cells.set(key, group);
  }
  engine.physicsStructures = { length: structures.length, expires: engine.time + 1, cells };
  return cells;
}
function extras(engine, e) {
  const cells = structureIndex(engine), x = Math.floor(e.x / CHUNK), y = Math.floor(e.y / CHUNK), out = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(...(cells.get(`${e.world}:${x + dx}:${y + dy}`) || []));
  return out;
}
function reset(e) {
  e.z = e.world === "space" ? 0 : e.mode === "flight" ? Physics.FLIGHT_HEIGHT : 0;
  e.vz = 0; e.groundZ = 0; e.grounded = e.mode !== "flight"; e.flightZ = e.z;
  e.forcedFall = false; e.physicsWorld = e.world;
  e.jumpWindup = 0;
  delete e.landedAt;
}
module.exports = (Engine) => {
  const tick = Engine.prototype.tick, act = Engine.prototype.act,
    add = Engine.prototype.addPlayer, profile = Engine.prototype.profile,
    spawn = Engine.prototype.spawn, snapshot = Engine.prototype.snapshot;
  Engine.prototype.physicsColliders = function(e, x = e.x, y = e.y) {
    return [];
  };
  Engine.prototype.spawn = function(...args) {
    const e = spawn.apply(this,args);
    e.mode ||= e.world === "space" ? "flight" : "ground";
    reset(e); Physics.ensure(e);
    Physics.move(e,0,0,this.physicsColliders(e));
    return e;
  };
  Engine.prototype.addPlayer = function(id, saved = {}) {
    const e = add.call(this,id,saved);
    e.mode = e.world === "space" || saved.mode === "flight" ? "flight" : "ground";
    reset(e);
    if (e.mode === "flight") e.z = e.flightZ = Physics.FLIGHT_HEIGHT;
    else if (Number.isFinite(saved.z)) e.z = Math.max(0,Math.min(2400,saved.z));
    Physics.ensure(e);
    Physics.move(e,0,0,this.physicsColliders(e));
    Physics.step(e,1/60,this.physicsColliders(e),{time:this.time});
    return e;
  };
  Engine.prototype.profile = function(e) {
    return { ...profile.call(this,e), mode:e.duelRestore?.mode??e.mode, z:e.duelRestore?.z??Physics.height(e) };
  };
  Engine.prototype.act = function(id,name) {
    if (name !== "jump") return act.call(this,id,name);
    const e = this.players.get(id);
    if (!e || e.stun > this.time || e.roundLocked || e.clashId || e.state === "dead" || e.moveAction) return false;
    if (!Physics.jump(e)) return false;
    e.sandboxJob = null;
    this.emit("jump",e);
    return true;
  };
  Engine.prototype.tick = function(dt = 1/30) {
    const before = new Map([...this.players.values()].map(e => [e.id,{world:e.world,x:e.x,y:e.y,state:e.state}]));
    const result = tick.call(this,dt);
    const step = Math.max(0,Math.min(.1,dt)), active = new Set(), actors = [];
    for (const e of this.players.values()) {
      const previous = before.get(e.id);
      if (e.physicsWorld !== e.world || previous && (previous.state === "dead" && e.state !== "dead" || Math.hypot(e.x-previous.x,e.y-previous.y)>800)) reset(e);
      const cx = Math.floor(e.x/CHUNK), cy = Math.floor(e.y/CHUNK);
      for (let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)active.add(`${e.world}:${cx+dx}:${cy+dy}`);
      actors.push(e);
    }
    for (const e of this.enemies) {
      if (e.dead || !active.has(cellKey(e))) continue;
      Physics.ensure(e);
      const target = this.players.get(e.combatTargetId);
      if (target && target.world === e.world && Math.hypot(e.x-target.x,e.y-target.y)<850) {
        if (target.mode === "flight" && e.mode !== "flight" && e.ai?.fly !== false && (e.effort??100)>20) Physics.takeoff(e);
        if (e.mode === "flight") e.flightZ = Physics.FLIGHT_HEIGHT;
      }
      actors.push(e);
    }
    for (const e of this.wildlife || []) {
      if (!active.has(cellKey(e))) continue;
      const species = Wildlife.species[e.species];
      e.mode ||= species?.kind === "bird" ? "flight" : "ground";
      actors.push(e);
    }
    this.physicsNpcActors ||= new Map();
    for (const [key,e] of this.physicsNpcActors) {
      if (this.time-e.seenAt>3) { this.physicsNpcActors.delete(key); continue; }
      const dx=e.goalX-e.x, dy=e.goalY-e.y, distance=Math.hypot(dx,dy), speed=e.mode==="flight"?250:140;
      Physics.ensure(e);
      const blend=1-Math.exp(-14*step/Math.sqrt(Physics.body(e).mass/80));
      e.vx+=((distance>1?dx/distance*Math.min(speed,distance/Math.max(step,.001)):0)-e.vx)*blend;
      e.vy+=((distance>1?dy/distance*Math.min(speed,distance/Math.max(step,.001)):0)-e.vy)*blend;
      this.move(e,e.vx*step,e.vy*step);
      actors.push(e);
    }
    for (const e of actors) {
      const landed = e.landedAt;
      const heavy = e.world==="otherworld" && e.lore && !e.lore.bubbles && Math.hypot(e.x-16000,e.y-1740)<300;
      Physics.step(e,step,this.physicsColliders(e),{time:this.time,gravityScale:heavy?1.6:1});
      if (e.landedAt!==landed && e.landingSpeed>280) this.emit("land",e,{tier:e.landingSpeed>620?"mid":"low",speed:e.landingSpeed});
    }
    Physics.resolveBodies(actors.filter(e=>e.state!=="dead"&&!e.clashId&&!e.roundLocked), (e,x,y)=>this.move(e,x,y));
    this.physicsDebris ||= [];
    this.physicsDebrisSerial ||= 0;
    for (const fx of this.effects) {
      if (fx.id <= (this.physicsDebrisEvent || 0)) continue;
      if (fx.world!=="space" && (fx.type==="impact"&&fx.heavy || fx.type==="land"&&fx.speed>430)) {
        for(let i=0;i<3&&this.physicsDebris.length<48;i++) {
          const angle=(Number(fx.id)*1.73+i*2.1)%Math.PI*2;
          this.physicsDebris.push({id:`dust:${++this.physicsDebrisSerial}`,kind:"stone",world:fx.world,x:fx.x,y:fx.y,z:Math.max(0,fx.visualZ??fx.z??0),groundZ:0,vx:Math.cos(angle)*(75+i*26),vy:Math.sin(angle)*(75+i*26),vz:140+i*35,mode:"ground",grounded:false,size:3+i,angle,life:1.4});
        }
      }
      this.physicsDebrisEvent = fx.id;
    }
    for (const e of this.physicsDebris) {
      e.life -= step;
      const list=this.physicsColliders(e);
      Physics.move(e,e.vx*step,e.vy*step,list,{radius:e.size});
      Physics.step(e,step,list,{time:this.time});
      if(e.grounded) {e.vx*=Math.exp(-10*step);e.vy*=Math.exp(-10*step);}
      e.angle += step*e.vx*.04;
    }
    this.physicsDebris=this.physicsDebris.filter(e=>e.life>0);
    return result;
  };
  Engine.prototype.snapshot = function(id) {
    const out = snapshot.call(this,id), player = this.players.get(id);
    if(!out||!player)return out;
    out.self.physicsColliders=[];
    out.physicsDebris=(this.physicsDebris||[]).filter(e=>e.world===player.world&&Math.hypot(e.x-player.x,e.y-player.y)<1450).map(({id,x,y,z,groundZ,size,angle,life})=>({id,x,y,z,groundZ,size,angle,life,kind:"stone"}));
    for (const animal of out.wildlife||[]) {
      const model=this.wildlife?.find(e=>e.id===animal.id);
      if(model)for(const field of fields)animal[field]=model[field];
    }
    this.physicsNpcActors ||= new Map();
    out.npcs=(out.npcs||[]).map(npc=>{
      const key=`${player.world}:${npc.id}:${npc.scripted?player.id:"shared"}`;
      let e=this.physicsNpcActors.get(key);
      if(!e||Math.hypot(e.x-npc.x,e.y-npc.y)>700){e={...npc,world:player.world,mode:npc.state==="fly"?"flight":"ground"};reset(e);this.physicsNpcActors.set(key,e);}
      e.goalX=npc.x;e.goalY=npc.y;e.seenAt=this.time;e.state=npc.state;e.skin=npc.skin;
      if(npc.companionOwner) {const owner=this.players.get(npc.companionOwner);if(owner){e.mode=owner.mode;e.flightZ=owner.mode==="flight"?Physics.FLIGHT_HEIGHT:0;}}
      const result={...npc,x:e.x,y:e.y,mode:e.mode};
      for(const field of fields)result[field]=e[field];
      return result;
    });
    if(this.physicsNpcActors.size>128)this.physicsNpcActors.delete(this.physicsNpcActors.keys().next().value);
    return out;
  };
};
