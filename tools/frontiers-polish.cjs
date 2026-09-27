const fs=require('fs');const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('tests/quests.test.js',s=>s.replace('C.QUESTS.length, 22','C.QUESTS.length, 28').replace('C.QUEST_BY_ID.get("namek-escape").next, null','C.QUEST_BY_ID.get("namek-escape").next, "android-warning"').replace('assert.equal(player.storyState.questId, null);\n  assert.ok(player.storyState.flags.includes("namek_saga_complete"))','assert.equal(player.storyState.questId, "android-warning");\n  assert.ok(player.storyState.flags.includes("namek_saga_complete"))'));
edit('shared/open-world.js',s=>s.replace("formation:template.formation};\n    const objects",`formation:template.formation};
    const river=4100+Math.sin(site.y/1700)*1100+Math.sin(site.y/620)*180;
    if(Math.abs(site.x-river)<620)site.x=river+(site.x<river?-640:640);
    const objects`).replace('>310);','>720);').replace('>330&&','>750&&'));
edit('public/open-world-art.js',s=>s.replace('>330&&','>750&&'));
edit('shared/content.js',s=>s.replace('    if (id !== "earth") {\n      const labels',`    const layouts={earth:[[1430,1510,168],[1980,1460,154],[1260,1900,140],[2070,1850,88]],namek:[[1360,1420,188],[1510,2210,145],[2220,2050,140],[2300,1450,177]],vegeta:[[1300,1470,155],[1980,1330,156],[2180,1960,153],[1320,2030,167]],future:[[1170,1440,187],[2090,1400,154],[1330,2100,145],[2260,1950,118]]};
    const layout=layouts[id]||([[1320,1430,188],[2160,1590,177],[2050,2180,140],[1250,2050,165]].map(([x,y,sprite],i)=>[x+(world.seed%3)*50,y-(world.seed%5)*30,sprite]));
    buildings.forEach((b,i)=>{[b.x,b.y,b.sprite]=layout[i];});
    if (id !== "earth") {
      const labels`));
edit('public/world-kit.js',s=>s.replace('window.UZWorldKit={',`const landmark=Art.landmark;
Art.landmark=(c,b,world,t)=>{if(b.sprite!=null&&sprite(c,'furniture',b.sprite,b.x,b.y,215)){c.save();c.fillStyle='#ecf2df';c.font='600 10px system-ui';c.textAlign='center';c.shadowColor='#001018';c.shadowBlur=4;c.fillText(b.label,b.x,b.y+46);c.restore();return;}landmark(c,b,world,t);};
window.UZWorldKit={`));
edit('src/combat-flow.js',s=>s.replace('if(e&&e.launch){','if(e&&(e.chaseUntil||0)>this.time){').replace('const hp=b.hp;','const hp=b.hp,oldStun=b.stun;let blocked=false;').replace('if(b.guardMeter>0)amount*=.2;','if(b.guardMeter>0){amount*=.2;blocked=true;}').replace('damage.call(this,a,b,amount,heavy);if(b.hp>=hp)return;','damage.call(this,a,b,amount,heavy);if(b.hp>=hp)return;\n  if(blocked){b.stun=oldStun;b.launch=null;return;}\n  if(a.combo===3&&heavy)b.chaseUntil=this.time+.65;'));
console.log('Maps, guards and campaign expectations corrected.');
