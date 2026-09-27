const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('all planetary landscapes render at boundaries and distant coordinates with finite geometry',()=>{
  let depth=0,calls=0;
  const c=new Proxy({}, {get:(_,key)=>key==='save'?()=>depth++:key==='restore'?()=>{assert.ok(--depth>=0)}:key==='createRadialGradient'?()=>({addColorStop(){}}):(...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),String(key));calls++},set:()=>true});
  const scope={Art:{},UZ:require('../shared/content'),UZOpenWorld:require('../shared/open-world'),UZLore:require("../shared/lore"),FlightUI:{update(){}},document:{createElement:()=>({getContext:()=>c})}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/open-world-art.js'),'utf8'),scope);
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/lore-art.js'),'utf8'),scope);
  for(const s of scope.UZLore.sites){scope.Art.openTerrain(c,{world:s.world,cam:s,reduced:false},{lore:{snake:3}},12,1800,1100);assert.equal(depth,0);}
  for(const w of scope.UZ.WORLDS)for(const cam of [{x:1600,y:1600},{x:5100,y:2800},{x:-42000,y:64000}])for(const reduced of [false,true]){
    scope.Art.openTerrain(c,{world:w.id,cam,reduced},{},12,1800,1100);assert.equal(depth,0,w.id);
  }
  assert.ok(calls>10000);
});
