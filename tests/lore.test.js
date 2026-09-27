const test=require('node:test'),assert=require('node:assert/strict'),{Engine}=require('../src/engine'),L=require('../shared/lore');
function setup(){const e=new Engine(),p=e.addPlayer('p');e.enemies=[];p.level=20;return {e,p};}
function train(e,p,s){p.world=s.world;p.x=s.x;p.y=s.y;e.train(p.id);assert.ok(p.training);for(let i=0;i<8;i++){e.time=p.training.beat;e.act(p.id,'attack');}}
test('Kaio requires ordered Snake Way traversal and Bubbles before granting combat skills',()=>{
 const {e,p}=setup(),s=L.sites.find(s=>s.id==='kaio');p.world=s.world;p.x=s.x;p.y=s.y;
 assert.match(e.train('p'),/Serpente/);e.tick();assert.equal(p.lore.snake,0);
 for(const q of L.snake){Object.assign(p,q);e.tick();}assert.equal(p.lore.snake,L.snake.length);
 p.x=s.x;p.y=s.y;assert.match(e.train('p'),/Bubbles/);
 p.x=s.x+Math.cos(e.time*.8)*150;p.y=s.y+Math.sin(e.time*.8)*110;e.interact('p');assert.equal(p.lore.bubbles,true);
 train(e,p,s);assert.ok(p.techniques.includes('genki'));assert.ok(p.lore.done.includes('kaio'));
 assert.equal(e.act('p','kaioken'),true);assert.equal(e.act('p','kaioken'),false);
 const enemy=e.spawn('otherworld','Dummy','soldier',p.x,p.y);e.damage(p,enemy,10);assert.equal(enemy.hp,100);
 const saved=e.profile(p),restored=new Engine().addPlayer('q',saved);assert.deepEqual(restored.lore,p.lore);
});
test('landmark progression grants once, rejects remote training and cannot be purchased around',()=>{
 const {e,p}=setup();assert.match(e.learn('p','kame'),/treinamento/);assert.equal(e.act('p','kaioken'),false);
 const karin=L.sites.find(s=>s.id==='karin');Object.assign(p,{world:karin.world,x:karin.x,y:karin.y});assert.match(e.train('p'),/primeiro/);
 const s=L.sites[0];train(e,p,s);assert.ok(p.techniques.includes('kame'));const points=p.points;e.train('p');assert.equal(p.points,points);assert.equal(p.training,null);
 train(e,p,karin);assert.ok(p.lore.done.includes('karin'));
});
test('missed final beat still completes a successful five-hit session, movement cancels',()=>{
 const {e,p}=setup(),s=L.sites[0];Object.assign(p,{world:s.world,x:s.x,y:s.y});e.train('p');
 for(let i=0;i<7;i++){e.time=p.training.beat;e.act('p','attack');}e.time=p.training.beat+.5;e.tick();assert.ok(p.lore.done.includes(s.id));
});
