const test=require('node:test'),assert=require('node:assert/strict'),{Engine}=require('../src/engine'),W=require('../shared/open-world');
function setup(){const e=new Engine(),p=e.addPlayer('p');e.enemies=[];e.nextExploration=1e9;return {e,p};}
function step(e,p,n,input={x:0,y:0,angle:0}){for(let i=0;i<n;i++){e.input(p.id,input);e.tick();}}
test('attack buffering executes one followup, magnetizes and respects target selection',()=>{
 const {e,p}=setup(),a=e.spawn('earth','A','soldier',p.x+240,p.y,false,{hp:1000,maxHp:1000}),b=e.spawn('earth','B','soldier',p.x+180,p.y+30,false,{hp:1000,maxHp:1000});
 e.act('p','target:'+a.id);e.act('p','attack');assert.ok(a.hp<1000);assert.equal(b.hp,1000);
 for(let i=0;i<50;i++)e.act('p','attack');step(e,p,8);assert.equal(p.combo,2);assert.ok(a.hp<970);
 e.act('p','target:missing');assert.equal(p.targetId,null);
});
test('ki aiming and firing preserve movement; cooldown release cannot strand charge',()=>{
 const {e,p}=setup();e.act('p','blastStart');const x=p.x;step(e,p,10,{x:1,y:0,angle:0});assert.ok(p.x>x+80);e.act('p','blast');const before=p.x;step(e,p,3,{x:1,y:0,angle:0});assert.ok(p.x>before+30);
 e.act('p','blastStart');e.act('p','blast');assert.equal(p.chargeAt,null);
});
test('holding melee consumes ki for a heavy launch and a perfect parry prevents launching',()=>{
 const {e,p}=setup();const foe=e.spawn('earth','A','soldier',p.x+80,p.y,false,{hp:1000,maxHp:1000});e.act('p','attackStart');step(e,p,16);foe.x=p.x+70;foe.y=p.y;const ki=p.ki;e.act('p','attackRelease');step(e,p,1);assert.ok(p.ki<ki-10);assert.equal(foe.launch.tier,'high');
 const q=e.addPlayer('q');q.world=p.world;q.x=p.x+40;q.y=p.y;q.state='guard';q.angle=Math.PI;q.guardAt=e.time;q.ki=100;e.damage(p,q,90,true);assert.equal(q.launch,undefined);assert.equal(q.hp,q.maxHp);
});
test('high impact destroys shared terrain once and snapshots synchronize debris',()=>{
 const {e,p}=setup(),q=e.addPlayer('q');const feature=W.features('earth',5,5).find(o=>o.kind==='house');p.x=q.x=feature.x;p.y=q.y=feature.y;
 e.impactTerrain(p,'high');const n=Object.keys(e.worldMemory).length;e.impactTerrain(p,'high');assert.equal(Object.keys(e.worldMemory).length,n);assert.ok(n>0);assert.deepEqual(e.snapshot('p').self.debris,e.snapshot('q').self.debris);assert.ok(e.snapshot('p').self.debris.some(d=>d.id===feature.id));
});
