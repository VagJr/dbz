const fs=require('fs');const edit=(file,fn)=>{let s=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');const put=(a,b)=>{if(!s.includes(a))throw Error(file+' missing '+a.slice(0,80));s=s.replace(a,b)};fn(put);fs.writeFileSync(file,s)};
edit('src/combat-brain.js',p=>p(" const b=e.brain||{seen:null},p=personality(e)"," const b=e.brain||{seen:null};if(t<(b.nextThink||0))return ['breathe','retreat'].includes(e.decision)?e.decision:'position';\n const p=personality(e)"));
edit('src/combat-flow.js',p=>{
 p("  return act.call(this,id,name);",`  const weave=name==='blast'&&p.combo===2&&this.time-p.comboAt<.65&&p.ki>=30&&p.chargeAt!=null&&this.time-p.chargeAt<.45;
  const result=act.call(this,id,name);
  if(weave&&result){const shot=this.shots.at(-1);if(shot?.owner===p.id){p.ki-=6;p.combo=0;shot.weave=true;shot.technique='weave';p.cooldowns.attack=Math.max(p.cooldowns.attack,this.time+.3);this.emit('cast',p,{angle:p.angle,text:'RUPTURA DE KI'});}}
  return result;`);
 p("const hp=b.hp,oldStun=b.stun;let blocked=false;",`const hp=b.hp,oldStun=b.stun,oldX=b.x,oldY=b.y;let blocked=false;
  if(this.players.has(b.id)&&!this.players.has(a.id)&&b.state==='dash'&&b.invuln>this.time&&(b.lastPerfectEvade||-10)+1<this.time){b.lastPerfectEvade=this.time;b.focus=Math.min(100,b.focus+8);b.counterUntil=this.time+.55;this.emit('parry',b,{text:'ESQUIVA PRECISA'});}`);
 p("(heavy?45:15)","(heavy||a.kiWeave?45:15)");
 p("amount*=.2;blocked=true;","amount*=.2;blocked=true;b.effort=Math.max(0,(b.effort??100)-10);b.counterReadyUntil=this.time+.9;b.guardUntil=Math.min(b.guardUntil||this.time+.12,this.time+.12);this.emit('parry',b,{text:'BLOQUEIO'});");
 p("b.state='stun';b.stun=this.time+.8;","b.state='stun';b.guardUntil=0;b.counterReadyUntil=0;b.stun=this.time+.8;");
 p("if(blocked){b.stun=oldStun;b.launch=null;return;}","if(blocked){b.stun=oldStun;b.x=oldX;b.y=oldY;b.launch=null;return;}");
});
edit('src/engine.js',p=>{
 p('          attacker.stun = t + 0.65;',"          target.lastParryAt=t;\n          if(!attacker.projectile)attacker.stun = t + 0.65;");
 p('          this.damage(s.weave?{...owner,kiWeave:true}:owner, e, s.damage, s.pierce);',`          const priorParry=e.lastParryAt;
          this.damage({...owner,projectile:true,kiWeave:!!s.weave}, e, s.damage, s.pierce);
          if(s.hostile&&e.lastParryAt!==priorParry&&e.lastParryAt===t){
            s.owner=e.id;s.hostile=false;s.angle+=Math.PI;s.life=.75;s.speed*=1.15;s.damage*=.8;s.hits=[];s.technique='divine';s.pressureUntil=0;
            this.emit('parry',e,{text:'DEVOLUÇÃO DE KI'});break;
          }`);
});
edit('public/combat-art.js',p=>{
 p('          c.strokeStyle = "#ff6565aa";',`          c.strokeStyle = e.counterStrike?'#f8ca70':'#ff6565aa';`);
 p('          c.restore();\n        }\n      this.trails',`          c.globalAlpha=1;c.rotate(-e.angle);c.fillStyle='#fff2df';c.font='bold 11px sans-serif';c.textAlign='center';
          c.fillText(e.counterStrike?'CONTRA-ATAQUE':e.pattern==='beam'?'DISPARO':e.pattern==='ring'?'ONDA':'GOLPE',0,-52);
          c.restore();
        }
      this.trails`);
 p('          galick: ["#c768ff", "#fff1ff"],','          hostile: ["#ff746b", "#fff0cf"],\n          weave: ["#d8a1ff", "#ffffff"],\n          galick: ["#c768ff", "#fff1ff"],');
 p('e.type === "enemyAttack" && e.pattern === "beam"','e.type === "enemyAttack" && e.pattern === "beam" && !e.projectile');
 p('            c.fillRect(3, 4, (61 * e.hp) / e.maxHp, 3);',`            c.fillRect(3, 4, (61 * e.hp) / e.maxHp, 3);
            if(e.effort!=null){c.fillStyle='#283949';c.fillRect(3,9,61,2);c.fillStyle=e.effort<25?'#ffc06c':'#89d6e7';c.fillRect(3,9,61*e.effort/100,2);}
            if(e.state==='guard'){c.strokeStyle='#8ddce9';c.lineWidth=3;c.beginPath();c.arc(30,-24,29,e.angle-.9,e.angle+.9);c.stroke();}
            if(e.state==='recover'||e.state==='breathe'){c.fillStyle='#9bffd2';c.font='bold 9px sans-serif';c.fillText('ABERTURA',4,20);}`);
});
edit('public/universe-art.js',p=>{
 p('      c.strokeStyle = "#80ecff";','      c.strokeStyle = s.hostile?"#ff8079":"#80ecff";');
 p("if(e.pattern==='beam'){c.moveTo(0,0);c.lineTo(e.radius||920,0);}","if(e.pattern==='beam'){c.moveTo(0,0);c.lineTo(e.projectile?55:(e.radius||920),0);}");
});
edit('public/app.js',p=>{
 p('beam: "Feixe em linha: saia da trajetória ou esquive.",','beam: "Disparo: saia da linha ou defenda no instante do impacto para devolver o ki.",');
 p("enemy.state==='recover'?'ABERTURA", "['recover','breathe'].includes(enemy.state)?'ABERTURA");
 p('(enemy.pattern === "beam" ? "FEIXE"', '(enemy.counterStrike ? "CONTRA-ATAQUE" : enemy.pattern === "beam" ? "DISPARO"');
});
edit('tests/open-world.test.js',p=>p('for(let i=0;i<20;i++)e.tick();','for(let i=0;i<32;i++)e.tick();'));
