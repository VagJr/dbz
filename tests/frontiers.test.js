const test=require('node:test'),assert=require('node:assert/strict');
const {Engine}=require('../src/engine'),W=require('../shared/open-world'),C=require('../shared/quests');
function setup(){const game=new Engine(),p=game.addPlayer('p');game.enemies=[];game.nextExploration=1e9;return{game,p};}
test('frontier compositions include peaceful spaces, formations, varied counts and safe starts',()=>{
 const cells=[];for(let x=-8;x<9;x++)for(let y=-8;y<9;y++)cells.push(W.chunk('earth',x,y));
 assert.ok(new Set(cells.map(c=>c.site.type)).size>=9);assert.ok(cells.some(c=>c.enemies.length===0));assert.ok(cells.some(c=>c.enemies.length>=5));
 for(const c of cells){assert.equal(new Set(c.props.map(p=>p.x+':'+p.y)).size,c.props.length);if(Math.hypot(c.site.x-1700,c.site.y-1740)<1350)assert.equal(c.enemies.length,0);}
});
test('committed attacks expose recovery and a patrol returns after exceeding its leash',()=>{
 const{game,p}=setup();p.x=p.y=10000;const e=game.spawn('earth','Atirador','frieza',p.x-400,p.y,false,{cooldown:0});
 game.tick();assert.equal(e.state,'windup');game.time=e.attackAt;game.tick();assert.equal(e.state,'attack');game.time=e.until+.01;game.tick();assert.equal(e.state,'recover');const count=e.attackCount;game.tick();assert.equal(e.attackCount,count);
 e.x=e.homeX+1200;e.stun=0;game.tick();assert.equal(e.state,'return');assert.ok(e.x<e.homeX+1200);
});
test('enemy frontal guard absorbs hits without launching and breaks on heavy pressure',()=>{
 const{game,p}=setup();const e=game.spawn('earth','Guarda','vegeta',p.x+70,p.y,false,{hp:1000,maxHp:1000});e.state='guard';e.angle=Math.PI;e.guardMeter=70;e.stun=0;
 game.damage(p,e,20);assert.equal(e.hp,996);assert.equal(e.launch,null);assert.equal(e.stun,0);
 game.damage(p,e,80,true);game.damage(p,e,80,true);assert.ok(e.guardBrokenUntil>game.time);
});
test('a confirmed launcher permits paid pursuit with a shared dodge cooldown',()=>{const{game,p}=setup();const e=game.spawn('earth','Alvo','soldier',p.x+140,p.y,false,{hp:1000,maxHp:1000});p.comboConfirmed=3;p.confirmedAt=game.time;e.chaseUntil=game.time+.8;p.targetId=e.id;p.ki=60;assert.equal(game.act('p','dash'),true);assert.equal(p.ki,32);assert.equal(p.comboConfirmed,0);assert.ok(p.cooldowns.dash>game.time);assert.equal(game.act('p','dash'),false);});

test('post-Namek story completes all six chapters with encounters, interactions and one-time rewards',()=>{
 const{game,p}=setup();Object.assign(p.storyState,{questId:'android-warning',saga:'androids',objectiveIndex:0,sequenceIndex:0,progress:0,objectiveStartedAt:0});
 let steps=0;
 while(p.storyState.questId&&steps++<100){const o=game.storyCurrent(p);assert.ok(o);const point=C.LANDMARKS[o.target];if(point){p.world=point.world;p.x=point.x;p.y=point.y;}if(o.type==='travel'){p.world=o.target;if(!p.visited.includes(o.target))p.visited.push(o.target);}
  if(o.encounter){const place=C.LANDMARKS[o.encounter.spawnAt||C.BOSS_LANDMARKS[o.encounter.bossId]];p.world=place.world;p.x=place.x;p.y=place.y;}
  game.time+=o.type==='survive'?o.seconds+1:1;p.lastStoryCheck=-1;game.storyTick(p);
  const current=game.storyCurrent(p);
  if(current&&['talk','interact'].includes(current.type))game.storyInteract(p);
  for(const e of game.enemies.filter(e=>!e.dead&&e.storyEncounter&&e.world===p.world)){p.x=e.x;p.y=e.y;game.damage(p,e,e.maxHp*100);}
 }
 assert.ok(steps<100,JSON.stringify({state:p.storyState,o:game.storyCurrent(p),enemies:game.enemies.filter(e=>!e.dead).map(e=>({id:e.id,world:e.world,boss:e.storyBossId})),world:p.world}));assert.equal(p.storyState.questId,null);assert.ok(p.storyState.flags.includes('cell_saga_complete'));assert.ok(p.storyState.flags.includes('buu_saga_complete'));assert.ok(p.lastDialogue.text.includes('Cuide dele'));
 const z=p.zenni;game.storyInteract(p);game.storyTick(p);assert.equal(p.zenni,z);
 const restored=game.addPlayer('restored',game.profile(p));assert.equal(restored.storyState.questId,null);
});


