const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../shared/open-world');
const {Engine}=require('../src/engine');
test('exploration is deterministic across negative and distant coordinates',()=>{
  assert.deepEqual(W.chunk('earth',-31,48),W.chunk('earth',-31,48));
  assert.notDeepEqual(W.chunk('earth',-31,48),W.chunk('namek',-31,48));
  assert.ok(W.region('earth',180000,210000).level>W.region('earth',1700,1740).level);
});
test('players share streamed encounters, remote cells retire, and space contains aerial enemies',()=>{
  const e=new Engine(),p=e.addPlayer('a'),q=e.addPlayer('b');p.storyState.questId=q.storyState.questId='db-pilaf';p.x=q.x=18000;p.y=q.y=19000;
  e.explorationTick();const count=e.enemies.filter(x=>x.cell).length;assert.ok(count>0);
  e.explorationTick();assert.equal(e.enemies.filter(x=>x.cell).length,count);
  p.world=q.world='space';p.x=q.x=80000;e.time=125;e.explorationTick();
  assert.ok(e.enemies.filter(x=>x.cell).every(x=>x.world==='space'&&x.mode==='flight'));
});
test('planet proximity enters atmosphere automatically without replacing player',()=>{
  const e=new Engine(),p=e.addPlayer('a');p.world='space';p.x=600;p.y=0;e.time=10;
  e.navigationTick(p,1/30);assert.equal(p.world,'earth');assert.equal(e.players.get('a'),p);assert.ok(p.altitude>.8);
});

test('space patrol telegraphs and lands a ranged attack',()=>{
  const e=new Engine(),p=e.addPlayer('pilot');e.enemies=[];p.world='space';p.x=80000;p.y=80000;p.invuln=0;
  e.spawn('space','Patrulha','frieza',p.x-400,p.y,false,{mode:'flight',damage:10,cooldown:0});
  const hp=p.hp;for(let i=0;i<32;i++)e.tick();
  assert.ok(e.effects.some(f=>f.type==='enemyAttack'&&f.pattern==='beam'));
  assert.ok(p.hp<hp);
});
test('defeated streamed encounter remains defeated when loaded by a new engine',()=>{
  const e=new Engine(),p=e.addPlayer('a');p.storyState.questId='db-pilaf';p.x=18000;p.y=19000;e.explorationTick();
  const enemy=e.enemies.find(x=>x.cell);p.x=enemy.x;p.y=enemy.y;
  e.damage(p,enemy,enemy.maxHp*10);assert.ok(e.worldMemory[enemy.ecologyKey].defeats===1);
  const restored=new Engine();restored.worldMemory=JSON.parse(JSON.stringify(e.worldMemory));
  const q=restored.addPlayer('b');q.storyState.questId='db-pilaf';q.x=p.x;q.y=p.y;restored.explorationTick();
  assert.equal(restored.enemies.find(x=>x.ecologyKey===enemy.ecologyKey).dead,true);
});
test('world memory survives an atomic disk save and reload',async()=>{
  const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{Store}=require('../src/store');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'uz-world-'));
  try {const s=new Store(dir);await s.init();s.worldMemory={'earth:1:1:0':{defeats:3,defeatedUntil:123}};await s.flush();
    const next=new Store(dir);await next.loadWorld();assert.deepEqual(next.worldMemory,s.worldMemory);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

