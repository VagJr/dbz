const fs=require('fs');function edit(p,f){const s=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');fs.writeFileSync(p,f(s));}function sub(s,a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,90));return s.replace(a,b);}
fs.writeFileSync('src/combat-motion.js',`"use strict";
// Authored pose families shared by every miniature, selected from actual controls.
module.exports=function motion(e,key,sequence,input=e.input||{}){
 const airborne=e.mode==='flight',moving=Math.hypot(input.x||0,input.y||0)>.1,
 boosted=!!input.boost,forward=(input.x||0)*Math.cos(e.angle)+(input.y||0)*Math.sin(e.angle),
 side=sequence%2?1:-1;
 let pose;
 if(key==='heavy')pose=airborne?'meteor':'uppercut';
 else if(key==='finisher')pose=airborne?'airSpin':'roundhouse';
 else if(boosted&&moving)pose='lunge';
 else if(airborne)pose=['airJab','airCross','airKnee'][sequence%3];
 else if(moving)pose=forward>.3?'stepJab':forward<-.3?'retreatJab':'slipHook';
 else pose=['jab','cross','hook','uppercut'][sequence%4];
 return {pose,side,moving,boosted,airborne,sequence};
};
`);
edit('shared/combat.js',s=>{
const changes={jab:[1,1,1,.075],link:[1,1,1,.08],finisher:[2,1,1,.16],heavy:[4,2,3,.24],ki:[2,1,2],charged:[7,2,6],weave:[2,1,2]};
for(const [k,v]of Object.entries(changes)){const start=s.indexOf('    '+k+': {'),end=s.indexOf('\n    },',start);let block=s.slice(start,end);for(const [field,val]of [['startup',v[0]+' / 30'],['active',v[1]+' / 30'],['recovery',v[2]+' / 30'],...(v[3]?[['stun',v[3]]]:[])])block=block.replace(new RegExp('      '+field+': [^,]+,'),'      '+field+': '+val+',');s=s.slice(0,start)+block+s.slice(end);}return s.replace('version: 3','version: 4');});
edit('src/combat-rhythm.js',s=>{
s=sub(s,'const C = require("../shared/combat");','const C = require("../shared/combat");\nconst Motion = require("./combat-motion");');
s=sub(s,'    const t = this.time,\n      m = C.moves[key];','    const t = this.time;\n    const basic=["jab","link","finisher"].includes(key);\n    const exhausted=basic&&p.ki<(C.moves[key]?.ki||0);\n    if(exhausted)key="jab";\n    const m=C.moves[key];');
s=sub(s,'      p.ki < m.ki ||','      (!basic && p.ki < m.ki) ||');
s=sub(s,'    const aim = this.target(p, m.range);','    if(p.aimReceived && t-p.inputAt<.25)p.angle=p.input.angle;\n    const aim = this.target(p, m.range);');
s=sub(s,'    if (aim && dist(p, aim) < 240 && front(p, aim))','    if (!p.input.manualAim && aim && dist(p, aim) < 240 && front(p, aim))');
s=sub(s,'    p.ki -= m.ki;','    p.ki = Math.max(0,p.ki-m.ki);\n    const tempo=exhausted?2:1;\n    p.attackSequence=(p.attackSequence||0)+1;');
s=sub(s,'impact: t + m.startup,','impact: t + m.startup*tempo,');
s=sub(s,'activeEnd: t + m.startup + m.active,','activeEnd: t + (m.startup+m.active)*tempo,');
s=sub(s,'end: t + m.startup + m.active + m.recovery,','end: t + (m.startup+m.active+m.recovery)*tempo,\n      exhausted,damageScale:exhausted?.4:1,\n      motion:Motion(p,key,p.attackSequence),');
s=sub(s,'    p.vx *= 0.3;\n    p.vy *= 0.3;','    p.vx *= basic ? .9 : .3;\n    p.vy *= basic ? .9 : .3;');
s=sub(s,'(p.moveAction.end - t <= C.buffer ||','(["jab","link","finisher"].includes(p.moveAction.key) || p.moveAction.end - t <= C.buffer ||');
s=sub(s,'p.attackData = { posture: m.posture, stun: m.stun, baseDamage: m.damage };','p.attackData = { posture: m.posture*(move.exhausted?.4:1), stun: move.exhausted?.05:m.stun, baseDamage: m.damage*move.damageScale };');
s=sub(s,'m.damage * this.combatMultiplier(p) * counter','m.damage * move.damageScale * this.combatMultiplier(p) * counter');
s=sub(s,'b.stun = Math.max(oldStun, t + 0.1);','b.stun = Math.max(oldStun, t + 1/30);');
s=sub(s,'        } else {\n          p.angle = m.angle;','        } else {\n          if(this.time<m.impact && ["jab","link","finisher"].includes(m.key) && p.aimReceived && this.time-p.inputAt<.25)m.angle=p.input.angle;\n          p.angle = m.angle;');
s=s.replace('this.time >= m.impact &&','this.time+1e-7 >= m.impact &&').replace('this.time < m.activeEnd\n      )','this.time < m.activeEnd-1e-7\n      )').replace('if (this.time >= m.end || cancel)','if (this.time+1e-7 >= m.end || cancel)');
s=sub(s,'            confirmed: q.moveAction.hit,','            confirmed: q.moveAction.hit,\n            exhausted:q.moveAction.exhausted,\n            motion:q.moveAction.motion,');
s=sub(s,'          name: original.counterStrike ? "Contra-ataque" : "Sequência",','          name: original.counterStrike ? "Contra-ataque" : "Sequência",\n          motion:original.motorMove.motion,');return s;});
edit('src/engine.js',s=>{
s=sub(s,'      boost: data.boost === true,','      boost: data.boost === true,\n      manualAim:data.manualAim===true,');s=sub(s,'    p.inputAt = this.time;','    p.inputAt = this.time;\n    p.aimReceived = true;');
s=sub(s,'        !locked && p.stun <= t && !input.guard && !input.charge;','        (!locked || (p.moveAction && ["jab","link","finisher"].includes(p.moveAction.key))) && p.stun <= t && !input.guard && !input.charge;');
s=sub(s,'      const intensity =\n        p.state === "chargeAim"','      const intensity =\n        p.moveAction && ["jab","link","finisher"].includes(p.moveAction.key) ? .72 : p.state === "chargeAim"');
s=sub(s,'        e.motorMove = EnemyMotor.prepare(e, t);','        e.motorMove = EnemyMotor.prepare(e, t);\n        e.motorMove.motion=require("./combat-motion")(e,e.motorMove.finisher?"finisher":"jab",e.attackCount,{x:Math.cos(e.angle),y:Math.sin(e.angle),boost:EnemyMotor.profile(e).pace>.75});');return s;});
edit('public/app.js',s=>{
s=sub(s,'    socket.emit("action", a);','    sendCombatInput();\n    socket.emit("action", a);');
s=sub(s,'        "Space",\n        "Tab",','        "Space",\n        "ControlLeft",\n        "Tab",');
s=sub(s,'    if (e.repeat) return;','    if (e.code === "ControlLeft") sendCombatInput();\n    if (e.repeat) return;');
s=sub(s,'    keys.delete(e.code);','    keys.delete(e.code);\n    if(e.code === "ControlLeft"){e.preventDefault();sendCombatInput();}');
s=sub(s,'    if(state){const wx=','    if(e.pointerType!=="touch"){pointer.x=e.clientX;pointer.y=e.clientY;pointer.used=true;}\n    if(state){const wx=');
s=sub(s,'  setInterval(() => {\n    if (!state || !socket.connected) return;','  function sendCombatInput() {\n    if (!state || !socket.connected) return;');
s=sub(s,'          pointer.y - innerHeight / 2,\n          pointer.x - innerWidth / 2,','          renderer.cam.y + (pointer.y-innerHeight/2)/renderer.zoom - state.self.y,\n          renderer.cam.x + (pointer.x-innerWidth/2)/renderer.zoom - state.self.x,');
s=sub(s,'guard: !disabled && (keys.has("KeyL") || held.guard),','guard: !disabled && (keys.has("ControlLeft") || held.guard),\n      manualAim:!disabled&&pointer.used,');
s=sub(s,'  }, 33);\n  $("chat-form")','  }\n  setInterval(sendCombatInput,33);\n  $("chat-form")');s=s.replace('"L · SHIFT"','"CTRL ESQUERDO · SHIFT"').replace('L defende; SHIFT','Ctrl esquerdo defende; SHIFT');return s;});
edit('public/index.html',s=>s.replace('<kbd>L</kbd>','<kbd>Ctrl</kbd>'));
edit('shared/content.js',s=>s.replace('guard: { name: "Defesa", key: "L",','guard: { name: "Defesa", key: "Ctrl",'));
edit('server.js',s=>s.replace('limited("input", 50)','limited("input", 100)'));
