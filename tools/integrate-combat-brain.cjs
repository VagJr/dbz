const fs=require('fs');const file='src/engine.js';let s=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');const put=(a,b)=>{if(!s.includes(a))throw Error('Missing '+a.slice(0,80));s=s.replace(a,b)};
put('const EnemyTactics = require("./enemy-tactics");','const EnemyTactics = require("./enemy-tactics");\nconst CombatBrain = require("./combat-brain");');
put('e.returning=false;e.guardUntil=0;e.recoveryUntil=0;e.attackCount=0;','e.returning=false;e.guardUntil=0;e.recoveryUntil=0;e.attackCount=0;e.brain=null;e.effort=100;e.guardMeter=70;e.counterReadyUntil=0;e.pressureUntil=0;');
put('      if (e.stun > t) {','      CombatBrain.maintain(e,dt);\n      if (e.stun > t) {');
put('      e.combatTargetId = target?.id || null;','      e.combatTargetId = target?.id || null;\n      const visible=!!target&&this.clearSight(e,target);\n      CombatBrain.observe(e,target,t,visible);');
put('e.observedThreatAt=null;','e.observedThreatAt=null;e.pressureUntil=0;');
put('      if (e.state === "windup") {',`      if (e.state === 'evade' && e.until>t) {this.tacticalStep(e,target||e,{x:Math.cos(e.evadeAngle),y:Math.sin(e.evadeAngle)},dt,e.world==='space'?1350:500);continue;}
      if (e.state === "windup") {`);
put('            pattern: e.pattern,','            pattern: e.pattern,\n            projectile:e.pattern===\'beam\', counter:!!e.counterStrike,');
put('          for (const p of this.players.values()) {\n            if (p.world !== e.world',`          if(e.pattern==='beam') {
            const speed=e.world==='space'?1400:760;
            this.shots.push({id:'s'+(++this.serial),owner:e.id,hostile:true,world:e.world,mode:e.mode,originX:e.x,originY:e.y,x:e.x,y:e.y,angle:e.angle,speed,r:14,damage:e.damage||24,life:attackRange/speed,pierce:false,hits:[],technique:'hostile',skin:e.skin});
            e.pressureUntil=t+attackRange/speed;
          }
          for (const p of this.players.values()) {
            if(e.pattern==='beam')break;
            if (p.world !== e.world`);
put('this.damage(e, p, e.damage || (e.boss ? 48 : 18), true);',"this.damage(e, p, (e.damage || (e.boss ? 48 : 18))*(e.counterStrike?1.15:1), true);");
const begin=s.indexOf('      const threat=target.meleeAt'),end=s.indexOf('      } else {\n        e.state = "run";',begin);if(begin<0||end<0)throw Error('Decision block');
s=s.slice(0,begin)+`      const canAttack=(t>=e.cooldown || e.counterReadyUntil>t)&&EnemyTactics.canCommit(e,this.enemies,target,t);
      const choice=CombatBrain.decide(e,target,t,canAttack,visible);
      e.angle = Math.atan2(target.y-e.y,target.x-e.x);
      if(choice==='guard') {
        e.state='guard';e.guardUntil=t+(e.ai?.guardDuration||.55);e.nextGuard=t+(e.ai?.guardInterval||3.2);e.effort-=8;continue;
      }
      if(choice==='evade') {
        e.state='evade';e.until=t+.26;e.evadeAngle=e.angle+(e.ai?.orbit||1)*Math.PI/2;e.nextEvade=t+3.4;e.effort-=26;
        this.emit('dash',e,{angle:e.evadeAngle,text:'PASSO LATERAL'});continue;
      }
      if(['strike','projectile','counter'].includes(choice)) {
        e.state='windup';e.counterStrike=choice==='counter';e.effort-=choice==='projectile'?30:e.counterStrike?22:20;
        if(e.counterStrike)e.counterReadyUntil=0;
        e.attackAt=t+Math.max(e.counterStrike?.4:.38,(e.ai?.windup||(e.boss?.52:.56))*(e.rank==='elite'?.88:1));
        e.windupAt=t;
        e.nextOpening=t+(e.ai?.attackCooldown||1.5)+(e.ai?.tempoOffset||0);
        e.attackCount=(e.attackCount||0)+1;
        e.pattern=choice==='projectile'?'beam':e.counterStrike?'cone':EnemyTactics.attackPattern(e,d);
        // A ranged archetype in contact still uses a short, readable melee strike.
        if(choice==='strike'&&e.pattern==='beam')e.pattern='cone';
        e.telegraphRadius=e.pattern==='beam'?(e.ai?.rangedRange||920):e.pattern==='rush'?(e.ai?.rushRange||225):(e.ai?.meleeRange||(e.boss?175:125));
        e.pressureUntil=e.attackAt+.3;
`+s.slice(end);
put('        e.state = "run";\n        const steering = EnemyTactics.steering(e, target, this.enemies, t);',`        e.state = choice==='breathe'?'breathe':'run';
        let steering=EnemyTactics.steering(e,target,this.enemies,t);
        if(choice==='retreat'||choice==='breathe')steering={x:-Math.cos(e.angle)*.7,y:-Math.sin(e.angle)*.7};`);
put('      const owner = this.players.get(s.owner);','      const owner = s.hostile?this.enemies.find(e=>e.id===s.owner&&!e.dead&&!e.returning):this.players.get(s.owner);');
put('      const targets = this.enemies.concat(', '      const targets = s.hostile?[...this.players.values()]:this.enemies.concat(');
put('this.damage(owner, e, s.damage, s.pierce);','this.damage(s.weave?{...owner,kiWeave:true}:owner, e, s.damage, s.pierce);');
// Private observation samples must never become snapshot payloads.
put('      enemies: this.enemies.filter(\n        (e) => !e.dead && e.world === p.world && distance(p, e) < 1450,\n      ),','      enemies: this.enemies.filter(\n        (e) => !e.dead && e.world === p.world && distance(p, e) < 1450,\n      ).map(({brain,...e})=>e),');
fs.writeFileSync(file,s);
let t=fs.readFileSync('src/enemy-tactics.js','utf8');t=t.replace('(other.state === "windup" || other.state === "attack")','(other.state === "windup" || other.state === "attack" || other.pressureUntil>time)');fs.writeFileSync('src/enemy-tactics.js',t);
