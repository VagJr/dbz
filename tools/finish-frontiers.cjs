const fs=require('fs');
const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('shared/open-world.js',s=>s.replace("duel:()=>[0,0]","duel:(i,n)=>[(i-(n-1)/2)*190,0]").replace("const [dx,dy]=formations[template.formation](i,template.props.length)","const [dx,dy]=formations[template.formation==='duel'?'street':template.formation](i,template.props.length)").replace("y:site.y+dy,sprite","y:site.y+dy-220,sprite").replace("template.type==='fortress'||type==='fortress'&&i===n-1","type==='fortress'&&i===n-1").replace("[['demon','Éclaireur local','scout'],['gas','Sentinela de ki','artillery'],['dabura','Duelista','duelist'],['hirudegarn','Guardião pesado','juggernaut']]","[[UZ.getWorld(id).enemySkin,'Batedor local','scout'],[UZ.getWorld(id).enemySkin,'Sentinela de ki','artillery'],[UZ.getWorld(id).enemySkin,'Duelista','duelist'],[UZ.getWorld(id).enemySkin,'Guardião pesado','juggernaut']]") );
edit('src/engine.js',s=>s.replace('p.combo === 3 ? 0.42 : 0.22','p.heavyStrike ? 0.62 : p.combo === 3 ? 0.5 : 0.28').replace('p.until = t + 0.18;','p.until = t + 0.2;').replace('e.combatTargetId = target?.id || null;',`e.combatTargetId = target?.id || null;
      // A patrol cannot chase a player indefinitely or fire through a reset.
      if (!e.storyEncounter && !e.boss && Math.hypot(e.x-e.homeX,e.y-e.homeY)>1100) e.returning=true;
      if(e.returning){ e.state='return';e.guardUntil=0;e.observedThreatAt=null;
        const hx=e.homeX-e.x,hy=e.homeY-e.y,hd=Math.hypot(hx,hy);
        if(hd<65){e.returning=false;e.hp=e.maxHp;e.cooldown=t+1;}else this.move(e,hx/hd*dt*260,hy/hd*dt*260);
        continue;
      }`).replace('e.until = t + 0.3;',`e.until = t + 0.22;
          e.recoveryUntil=t+(e.pattern==='ring'?.85:e.pattern==='beam'?.7:.5);`).replace('if (e.guardUntil > t)',`if (e.recoveryUntil > t) { e.state = 'recover'; continue; }
      if (e.guardUntil > t)`).replace('if (!e.boss && e.ai?.guardInterval && target.state === "attack" && d < 205 && t >= (e.nextGuard || 0)) {',`const threat=target.meleeAt!=null||target.chargeAt!=null||target.state==='attack';
      if(threat&&d<320){e.observedThreatAt??=t;}else e.observedThreatAt=null;
      if (e.ai?.guardInterval && e.observedThreatAt!=null && t-e.observedThreatAt>=(e.ai.reactionDelay||.35) && d < 320 && t >= (e.nextGuard || 0) && t>(e.guardBrokenUntil||0)) {`).replace('e.attackAt = t + (e.ai?.windup || (e.boss ? 0.52 : 0.38));',"e.attackAt = t + Math.max(.32,(e.ai?.windup || (e.boss ? .52 : .48)) * (e.rank==='elite'?.88:e.rank==='regular'?1.1:1));"));
edit('src/enemy-tactics.js',s=>s.replace('const desired = ai.desiredDistance || 165;',`// Wounded ranged fighters seek breathing room; melee escorts keep a flank.
  const wounded=enemy.hp/enemy.maxHp<.3;
  const desired = (ai.desiredDistance || 165)+(wounded&&ai.rangedRange?130:0);`).replace('const tangent = (ai.orbit || 1)',"const tangent = ((enemy.formation==='pincer'?(enemy.homeX<target.x?-1:1):ai.orbit)||1)"));
edit('src/combat-flow.js',s=>s.replace("if(name==='dash'||name==='blastStart')",`if(name==='dash'&&p.combo===3&&this.time-p.comboAt<.85&&p.ki>=22&&(p.cooldowns.chase||0)<=this.time){
    const e=this.target(p,650);
    if(e&&e.launch){p.ki-=22;p.cooldowns.chase=this.time+2.8;p.combo=0;p.cooldowns.attack=this.time+.12;
      const a=Math.atan2(e.y-p.y,e.x-p.x),d=Math.hypot(e.x-p.x,e.y-p.y);
      this.move(p,Math.cos(a)*Math.max(0,d-80),Math.sin(a)*Math.max(0,d-80));
      p.angle=a;p.invuln=this.time+.12;p.queuedAttack=null;p.meleeAt=null;this.emit('dash',p,{angle:a,text:'PERSEGUIÇÃO'});return true;
    }
  }
  if(name==='dash'||name==='blastStart')`).replace("const hp=b.hp;","const hp=b.hp;\n  if(!this.players.has(b.id)&&b.state==='recover')amount*=1.2;").replace("const tier=heavy?",`// Brief hitstun resistance prevents an infinite party stun lock.
  b.hitChain=this.time-(b.lastHitAt||-10)<.7?(b.hitChain||0)+1:1;b.lastHitAt=this.time;
  if(!this.players.has(b.id)&&b.hitChain>5){b.launch=null;b.stun=Math.min(b.stun,this.time+.04);return;}
  const tier=heavy?`).replace("for(const e of this.enemies){const interval=e.ai?e.ai.guardInterval:8,duration=e.ai?(e.ai.guardDuration||.45):1.1;if(interval>0&&(e.boss||e.level>=6)&&!e.dead&&e.stun<=this.time&&(e.guardBrokenUntil||0)<this.time&&['idle','run','guard'].includes(e.state)&&this.time%interval<duration){e.state='guard';e.guardMeter??=70;}}","for(const e of this.enemies){if(e.state!=='guard'&&e.stun<=this.time)e.guardMeter=Math.min(70,(e.guardMeter??70)+dt*8);}") );
// Compose distinct site footprints instead of another wheel of paths and houses.
edit('public/open-world-art.js',s=>{const a=s.indexOf("      const site=e.chunk.site;if(visible(site,350)"),b=s.indexOf('\n    }\n    const objects=[];',a);if(a<0||b<0)throw Error('site art anchor');return s.slice(0,a)+`      const site=e.chunk.site;if(visible(site,650)&&e.houses.length){
        c.save();c.translate(site.x,site.y);c.strokeStyle=p[3]+'90';c.lineWidth=38;
        c.beginPath();
        if(site.formation==='street'){c.moveTo(0,-510);c.lineTo(0,480);c.moveTo(-300,90);c.lineTo(310,90);}
        else if(site.formation==='line'){c.moveTo(-500,40);c.lineTo(500,40);}
        else if(site.formation==='pincer'){c.moveTo(-90,-510);c.bezierCurveTo(230,-190,-180,120,70,450);}
        else if(site.formation==='depth'){c.rect(-330,-450,660,690);c.moveTo(0,240);c.lineTo(0,430);}
        else if(site.formation==='duel'){c.rect(-270,-250,540,490);}
        else{c.moveTo(-300,330);c.quadraticCurveTo(-80,-160,360,-290);}
        c.stroke();
        if(site.mood==='military'){c.strokeStyle='#d8c46970';c.lineWidth=3;c.setLineDash([20,16]);c.stroke();}
        if(site.mood==='ancient'||site.mood==='trial'){c.lineWidth=2;c.strokeStyle='#eae4c977';c.beginPath();c.moveTo(-100,-70);c.lineTo(0,-160);c.lineTo(100,-70);c.lineTo(0,20);c.closePath();c.stroke();}
        c.restore();
      }`+s.slice(b);});
console.log('Combat cadence, readable AI and site footprints integrated.');
