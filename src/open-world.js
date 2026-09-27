'use strict';
const World=require('../shared/open-world');
const Lore=require('../shared/lore');
const Tactics=require('./enemy-tactics');
const {getWorld}=require('../shared/content');
module.exports=function(Engine){
  Engine.prototype.explorationTick=function(){
    this.explorationCells??=new Map();
    const active=new Set();
    for(const p of this.players.values()){
      if(p.duelId||p.world==='earth'&&p.storyState?.questId==='db-paozu')continue;
      const cx=Math.floor(p.x/World.CHUNK),cy=Math.floor(p.y/World.CHUNK);
      p.region=World.region(p.world,p.x,p.y);
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
        const key=`${p.world}:${cx+dx}:${cy+dy}`;active.add(key);
        if(this.enemies.length>=2400)continue;
        if(this.explorationCells.has(key)){this.explorationCells.set(key,this.time);continue;}
        const chunk=World.chunk(p.world,cx+dx,cy+dy);
        this.explorationCells.set(chunk.key,this.time);
        const w=getWorld(p.world);
        for(const [index,spawn] of chunk.enemies.entries()){
          const ecologyKey=`${chunk.key}:${index}`,memory=this.worldMemory?.[ecologyKey];
          if(Lore.sites.some(s=>s.world===p.world&&Math.hypot(s.x-spawn.x,s.y-spawn.y)<450)||p.world==='otherworld'&&Lore.snake.some(s=>Math.hypot(s.x-spawn.x,s.y-spawn.y)<350))continue;
          if(p.world!=='space'&&Math.hypot(spawn.x-1700,spawn.y-1740)<1050)continue;
          const level=p.world==='space'?Math.max(12,spawn.level):spawn.level;
          const hp=190+level*30;
          this.spawn(p.world,p.world==='space'?'Patrulha espacial':spawn.name||w.enemy,spawn.skin||w.enemySkin,spawn.x,spawn.y,false,{rank:spawn.rank,siteType:spawn.siteType,formation:spawn.formation,ai:{...Tactics.identity(spawn.skin||w.enemySkin,index,p.world),...(p.world==='space'?{}:Tactics.ROLES[spawn.role]),rank:spawn.rank},ecologyKey,dead:memory?.defeatedUntil>Date.now(),respawnAt:this.time+Math.max(0,((memory?.defeatedUntil||0)-Date.now())/1000),cell:chunk.key,level,mode:spawn.mode,hp,maxHp:hp,rewardXP:24+level*7,damage:12+level*2});
        }
      }
    }
    // Unobserved cells sleep only after the normal respawn window. Active
    // players share cells; crossing a border cannot instantly reset a kill.
    for(const [key,last]of this.explorationCells)if(!active.has(key)&&this.time-last>120){this.explorationCells.delete(key);this.enemies=this.enemies.filter(e=>e.cell!==key);}
  };
};
