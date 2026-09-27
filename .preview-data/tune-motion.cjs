const fs=require('fs');function edit(p,f){fs.writeFileSync(p,f(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')))}function sub(s,a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,80));return s.replace(a,b)}
edit('src/enemy-motor.js',s=>{
const a=s.indexOf('function profile(e) {'),b=s.indexOf('function prepare(e, t)',a);
s=s.slice(0,a)+`function profile(e) {
  const n=tier(e),progress=Math.max(0,Math.min(1,((e.level||1)-1)/17));
  const pace=Math.max(progress,n*.28),frames=(slow)=>Math.max(1,Math.round(slow*(1-pace)+pace));
  return {pace,progress,reaction:Math.max(.1,[.3,.22,.16][n]*(1-progress*.5)),
    think:frames([4,3,2][n])/30,startup:frames([7,5,4][n])/30,
    recovery:frames([5,3,2][n])/30,active:pace>.5?1/30:2/30,
    gap:(1-pace)*[4,2,1][n]/30,chain:Math.round(2+pace*4),
    guardRetry:[1.2,.95,.75][n]*(1-progress*.45),
    evadeRetry:[2.4,1.8,1.4][n]*(1-progress*.4)};
}
`+s.slice(b);
s=s.replace('active: 2 / 30,','active: p.active,').replace('Math.max(e.pattern === "ring" ? 0.4 : 0.3, (e.ai?.windup || 0.5) * 0.7)','Math.max(e.pattern === "ring" ? .2 : .133, (e.ai?.windup || .5)*(.7-p.pace*.35))').replace('? 0.55','? .55-p.pace*.25').replace('? p.startup + 2 / 30','? p.startup + 1 / 30').replace('p.startup + (finisher ? 2 / 30 : 0)','p.startup + (finisher ? 1 / 30 : 0)').replace('recovery: beam ? 0.3 : special || finisher ? 0.3 : p.recovery,','recovery: beam || special || finisher ? Math.max(1/30,.2-p.pace*.16) : p.recovery,').replace('stun: finisher || special ? 0.28 : 0.2,','stun: finisher || special ? .16 : .075,').replace('e.recoveryUntil += hit ? 0.1 : 0.16;','e.recoveryUntil += (hit ? .05 : .12)*(1-p.pace*.8);');return s;});
edit('src/combat-brain.js',s=>sub(s,'return Math.max(4 / 30, e.ai?.reactionDelay ?? Motor.profile(e).reaction);','const p=Motor.profile(e);\n  return Math.max(.1,e.ai?.reactionDelay!=null?e.ai.reactionDelay*(1-p.progress*.5):p.reaction);'));
edit('src/open-world.js',s=>s.replace(",reactionDelay:spawn.rank==='elite'?.22:spawn.rank==='veteran'?.35:.55",''));
edit('public/miniature-art.js',s=>{
s=sub(s,"const strikeSide=(e.combo||1)%2?1:-1;",`const motion=m?.motion, pose=motion?.pose||((e.combo===3)?'roundhouse':(e.combo===2)?'cross':'jab');
    const strikeSide=motion?.side||((e.combo||1)%2?1:-1);
    const reach=Math.max(0,punch), kick=['roundhouse','airSpin','airKnee'].includes(pose);
    const movingStrike=hit&&motion?.moving, driving=hit&&pose==='lunge';`);
s=sub(s,'const twist=hit?strikeSide*(punch*.32-.10)',"const twist=hit?strikeSide*(punch*(['hook','slipHook','airSpin'].includes(pose)?.65:.32)-.10)");
s=sub(s,"const tilt=flight?.72:hit?.40+Math.max(0,punch)*.25", "const tilt=flight?.72:hit?(driving?.62:.32)+reach*(pose==='uppercut'?.12:.25)");
s=sub(s,'    if(rush){c.scale(1,flight?1.12:.90);c.translate(0,3);}',`    if(rush||driving){c.scale(1,flight?1.12:.90);c.translate(0,3);}
    if(hit&&['airSpin','roundhouse'].includes(pose))c.rotate(strikeSide*reach*.65);
    if(hit&&pose==='uppercut')c.translate(0,reach*4);
    if(hit&&pose==='meteor'){c.scale(1,1-reach*.13);c.translate(0,reach*5);}
    if(hit&&!reduced&&(driving||motion?.airborne||pose==='slipHook')){
      c.save();c.globalAlpha=.22;for(let i=1;i<=3;i++)stroke([[-10-i*3,-8-i*6],[strikeSide*8,-14-i*7]],form?'#ffdd7c':'#a9eeff',2);c.restore();
    }`);
s=sub(s,'Math.sin(i*.42-time*2)*(5+i*.4)','Math.sin(i*.42-time*(hit?12:2))*(5+i*.4+(hit?reach*4:0))');
s=sub(s,'const gait=walk?Math.sin(time*14+s*Math.PI/2):0;','const gait=walk||movingStrike?Math.sin(time*(movingStrike?23:14)+s*Math.PI/2):0;');
s=sub(s,"      if(hit&&e.combo!==3){", "      if(hit&&!kick){");
s=sub(s,'      if(hit&&e.combo===3&&s===1){knee=[12-7*punch,-3+13*punch];foot=[19-12*punch,-7+40*punch];}',`      if(hit&&kick&&s===strikeSide){
        if(pose==='airKnee'){knee=[s*9,1+16*reach];foot=[s*8,-9+18*reach];}
        else {const sweep=pose==='airSpin'?Math.sin(reach*Math.PI*.7):reach;knee=[s*(12-9*sweep),-3+14*reach];foot=[s*(23-24*sweep),-7+43*reach];}
      }
      if(movingStrike&&!kick){foot[1]+=gait*3;knee[0]+=gait*2;}
      if(hit&&pose==='retreatJab'){knee=[s*9,-11];foot=[s*13,-19-reach*3];}
      if(driving){knee=[s*7,-9+s*4];foot=[s*10,-18+s*8];}`);
s=sub(s,'        if(s===strikeSide&&e.combo!==3){','        if(s===strikeSide&&!kick){');
s=sub(s,"      if(state==='stun'){elbow=[s*19,0];hand=[s*23,5];}",`      if(hit){
        if(kick){elbow=[s*18,2];hand=[s*22,6+reach*5];}
        else if(pose==='meteor'){elbow=[s*(13-8*reach),12+reach*3];hand=[s*4,24+reach*8];}
        else if(s===strikeSide){
          if(['hook','slipHook','airCross'].includes(pose)){elbow=[s*(22-6*reach),5+reach*12];hand=[s*(25-29*reach),9+23*reach];}
          else if(pose==='uppercut'){elbow=[s*(17-8*reach),-3+10*reach];hand=[s*(14-10*reach),-5+38*reach];}
          else if(pose==='cross'){elbow=[s*(16-12*reach),3+15*reach];hand=[s*(14-19*reach),8+33*reach];}
          else if(pose==='stepJab'){elbow=[s*(17-9*reach),5+16*reach];hand=[s*(16-10*reach),10+32*reach];}
          else if(pose==='retreatJab'){elbow=[s*(18-6*reach),3+11*reach];hand=[s*(17-8*reach),7+25*reach];}
          else if(pose==='lunge'){elbow=[s*(13-9*reach),8+16*reach];hand=[s*4,12+36*reach];}
          else if(pose==='airJab'){elbow=[s*(15-9*reach),7+14*reach];hand=[s*5,11+33*reach];}
        }
      }
      if(state==='stun'){elbow=[s*19,0];hand=[s*23,5];}`);return s;});
