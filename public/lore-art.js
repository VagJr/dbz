/* Authored landmarks occupy the same world coordinates as their server challenges. */
(()=>{
 const base=Art.openTerrain,TAU=Math.PI*2;
 function oval(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
 Art.openTerrain=(c,r,p,t,w,h)=>{
  const visible=(x,y,pad=500)=>Math.abs(x-r.cam.x)<w/2+pad&&Math.abs(y-r.cam.y)<h/2+pad;
  if(r.world!=='otherworld')base(c,r,p,t,w,h);
  else{
   c.fillStyle='#c8a06f';c.fillRect(r.cam.x-w/2-10,r.cam.y-h/2-10,w+20,h+20);
   for(let y=Math.floor((r.cam.y-h/2)/240)*240;y<r.cam.y+h/2+300;y+=240)for(let x=Math.floor((r.cam.x-w/2)/400)*400;x<r.cam.x+w/2+400;x+=400)oval(c,x+Math.sin(y)*80,y,260,100,'#efdaa465');
   for(const [color,width,offset]of [['#735a6b',140,28],['#dab690',140,0],['#f1d9ad',108,-7]]){c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.beginPath();UZLore.snake.forEach((q,i)=>i?c.lineTo(q.x,q.y+offset):c.moveTo(q.x,q.y+offset));c.stroke();}
   for(let i=0;i<UZLore.snake.length;i++){const q=UZLore.snake[i];if(!visible(q.x,q.y,100))continue;c.strokeStyle='#9b795f';c.lineWidth=2;c.beginPath();c.ellipse(q.x,q.y,25,42,0,-1,1);c.stroke();if(i===(p?.lore?.snake||0)){oval(c,q.x,q.y,35,22,'#f9ed9755');c.fillStyle='#fff5cc';c.font='14px system-ui';c.textAlign='center';c.fillText('MARCO '+(i+1),q.x,q.y-85);}}
   const first=UZLore.snake[0];oval(c,first.x-50,first.y,100,70,'#77926a');oval(c,first.x-100,first.y-24,12,9,'#f4dc77');oval(c,first.x-100,first.y+24,12,9,'#f4dc77');
  }
  for(const s of UZLore.sites){if(s.world!==r.world||!visible(s.x,s.y))continue;c.save();c.translate(s.x,s.y);
   if(s.id==='kaio'){
    oval(c,14,35,285,230,'#77597755');const g=c.createRadialGradient(-75,-70,20,0,0,285);g.addColorStop(0,'#b9cc77');g.addColorStop(.7,'#729c59');g.addColorStop(1,'#3f6650');oval(c,0,0,280,230,g);
    c.strokeStyle='#e4c99a';c.lineWidth=17;c.beginPath();c.ellipse(0,0,210,160,-.2,0,TAU);c.stroke();
    c.fillStyle='#dcd7ac';c.fillRect(-62,-85,100,65);c.fillStyle='#a3665d';c.beginPath();c.moveTo(-75,-83);c.lineTo(-12,-127);c.lineTo(53,-83);c.closePath();c.fill();c.fillStyle='#494f57';c.fillRect(-23,-50,23,30);
    c.fillStyle='#dbbf74';c.fillRect(85,50,55,27);oval(c,93,77,7,5,'#303e40');oval(c,130,77,7,5,'#303e40');
    for(const x of [-140,140]){c.strokeStyle='#675e42';c.lineWidth=7;c.beginPath();c.moveTo(x,-45);c.lineTo(x-10,-100);c.stroke();oval(c,x-12,-110,42,30,'#476f43');}
    const a=(p?.loreTime??t)*.8;oval(c,Math.cos(a)*150,Math.sin(a)*110,13,10,'#6a4936');oval(c,Math.cos(a)*150+4,Math.sin(a)*110-8,8,7,'#b99562');
   }else if(s.id==='karin'){
    oval(c,20,25,105,75,'#243c4c40');c.fillStyle='#d8c69e';c.fillRect(-28,-40,56,120);oval(c,0,-40,95,60,'#eedcb2');oval(c,0,-55,70,42,'#a4896e');
    for(let i=-2;i<=2;i++){c.fillStyle='#f6e8c2';c.fillRect(i*22-5,-80,10,40);}oval(c,0,-90,80,45,'#dcc18d');
   }else if(s.id==='lookout'){
    oval(c,15,40,260,180,'#324f6540');oval(c,0,0,250,170,'#d6c4ae');oval(c,0,-10,238,158,'#f5e8cd');c.strokeStyle='#c98876';c.lineWidth=10;c.beginPath();c.ellipse(0,-10,215,140,0,0,TAU);c.stroke();
    c.fillStyle='#efe4ba';c.fillRect(-65,-100,130,80);oval(c,0,-100,75,40,'#b68853');for(const x of [-160,160]){c.fillStyle='#786a47';c.fillRect(x-4,-50,8,60);oval(c,x,-60,35,24,'#5c9064');}
   }else{
    oval(c,12,18,130,95,'#26384735');oval(c,0,0,120,85,s.id==='kame'?'#e7d59c':'#bbacaa');c.fillStyle=s.id==='kame'?'#e3a3a2':'#e5d4bd';c.fillRect(-65,-50,130,90);c.fillStyle=s.id==='kame'?'#ae6559':'#8a7389';c.beginPath();c.moveTo(-80,-50);c.lineTo(0,-105);c.lineTo(80,-50);c.closePath();c.fill();c.fillStyle='#506d83';c.fillRect(-42,-25,25,20);c.fillRect(18,-25,25,20);c.fillStyle='#66565b';c.fillRect(-12,7,24,33);
    if(s.id==='kame'){c.fillStyle='#8a5057';c.font='bold 12px system-ui';c.textAlign='center';c.fillText('KAME HOUSE',0,0);}
   }
   oval(c,0,70,12,9,'#3f647b');oval(c,0,61,8,8,'#edc6a0');
   c.fillStyle='#fff1ca';c.font='600 15px system-ui';c.textAlign='center';c.fillText(s.name,0,-(s.id==='kaio'?255:s.id==='lookout'?200:135));c.font='12px system-ui';c.fillText(s.master+' · E conversar / T treinar',0,s.id==='kaio'?260:135);c.restore();
  }
  const target=p?.targetId&&r.combatTarget;
  if(target){c.strokeStyle='#f7db8c';c.lineWidth=2;c.beginPath();c.ellipse(target.x,target.y,36,24,0,0,TAU);c.stroke();}
  if(p?.meleeCharge>.15){c.strokeStyle='#ffb86b';c.lineWidth=3;c.beginPath();c.arc(p.x,p.y,38,-Math.PI/2,-Math.PI/2+Math.min(1,p.meleeCharge/.5)*TAU);c.stroke();}
  const guide=p?.guide;if(guide&&guide.world===r.world&&Number.isFinite(guide.targetX)){
   const x=guide.targetX,y=guide.targetY;c.save();c.strokeStyle='#ffe0a0';c.lineWidth=3;c.setLineDash([8,7]);c.beginPath();c.ellipse(x,y,guide.radius||100,(guide.radius||100)*.65,0,0,TAU);c.stroke();c.setLineDash([]);
   if(guide.skin&&Art.fighter)Art.fighter(c,{x,y,skin:guide.skin,state:'idle',angle:1.57},t,1);
   c.fillStyle='#fff0bd';c.font='bold 13px sans-serif';c.textAlign='center';c.fillText(guide.speaker+' · '+(guide.interactable?'E / Interagir':'OBJETIVO'),x,y-65);c.restore();
  }
  if(p?.duel){c.save();c.strokeStyle='#8acfff';c.lineWidth=3;c.setLineDash([15,10]);c.beginPath();c.arc(p.duel.x,p.duel.y,p.duel.radius,0,TAU);c.stroke();c.restore();}
  const q=p?.loreObjective;if(q&&q.world===r.world){const a=Math.atan2(q.targetY-p.y,q.targetX-p.x),d=Math.hypot(q.targetX-p.x,q.targetY-p.y);if(d>180){c.save();c.translate(p.x+Math.cos(a)*100,p.y+Math.sin(a)*100);c.rotate(a);c.fillStyle='#f7dc87';c.beginPath();c.moveTo(13,0);c.lineTo(-8,-7);c.lineTo(-8,7);c.closePath();c.fill();c.restore();}}
 };
})();
