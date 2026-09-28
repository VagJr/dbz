/* Continuous illustrated terrain. Static relief is cached; water and foliage animate independently. */
(()=>{
  const S=UZOpenWorld.CHUNK, PAD=440, cache=new Map(), TAU=Math.PI*2;
  const wetRelief=new Set(['namek','kanassa']),redRelief=new Set(['vegeta','demon','vampa']);
  const industrialRelief=new Set(['future','tsufuru','frieza']),celestialRelief=new Set(['divine','champa','zeno','otherworld','sacred']);
  const themes={
    earth:['#70915d','#91ae70','#a58c66','#d2b58b','#326f82','cottage'],
    namek:['#428ea0','#6fbcbb','#b99175','#dfbe8e','#368563','shell'],
    vegeta:['#9b6958','#c49572','#81514a','#d1a076','#695172','fort'],
    future:['#626e69','#7e8878','#616473','#aaa594','#416b77','ruin'],
    otherworld:['#a38bac','#c3acd0','#997487','#e3c69e','#dfa4cf','temple'],
    demon:['#59445d','#806376','#614653','#b58b83','#b54d64','spire'],
    vampa:['#93964f','#b1b674','#75683e','#c4ad72','#677a48','wild'],
    divine:['#88979c','#b1bab9','#8c7da2','#d5c8c4','#7e91bd','temple'],
    arena:['#555e70','#89929a','#535866','#adb2bb','#34324c','ruin'],
    yardrat:['#bb8885','#d9ad9d','#966776','#deb29b','#686799','spire'],
    cereal:['#789a83','#a1baa0','#89786c','#c9b797','#457e88','cottage'],
    sadala:['#968269','#b9a274','#79614c','#d0b68c','#4c8177','fort'],
    champa:['#947f9d','#b8a3bb','#877087','#dbc39b','#9483b9','temple'],
    tsufuru:['#738e7d','#9ab6a0','#7b8290','#bfccbb','#41829b','capsule'],
    kanassa:['#729e9f','#a5c6b0','#697a99','#bcbfb4','#346b97','shell'],
    konatsu:['#82996b','#adc18b','#8a7f74','#c9baa2','#518b91','cottage'],
    sacred:['#82a878','#b3ca93','#989089','#ddceb1','#7596bc','temple'],
    zeno:['#9294b6','#c4bcd2','#857798','#e2c8a6','#8aa6c7','temple'],
    frieza:['#777f9b','#a0aac1','#62647d','#bdc0cd','#426782','fort']
  };
  function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
  function poly(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
  // Each planet has a small visual vocabulary painted once into the chunk canvas.
  // Keeping these marks in the terrain cache makes the extra detail free while moving.
  function groundDetails(c,id,chunk,p,rand){
    const stroke=(points,color,width=2,close=false)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(close)c.closePath();c.stroke();};
    const ring=(x,y,rx,ry,color,width=2)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.stroke();};
    const shard=(x,y,s,color)=>poly(c,[[x-s*.7,y+s*.12],[x-s*.14,y-s*.58],[x+s*.8,y-s*.1],[x+s*.27,y+s*.45]],color);
    const seed=(x,y,s,color)=>{ellipse(c,x,y,s,s*.36,color);stroke([[x-s*.6,y+s*.1],[x+s*.42,y-s*.2]],p[2]+'78',1);};
    for(let i=0;i<22;i++){
      const x=chunk.x+80+rand()*(S-160),y=chunk.y+80+rand()*(S-160),s=38+rand()*95;
      switch(id){
        case 'earth':
          ring(x,y,s*.7,s*.27,'#d9e9ad35',2);stroke([[x-s*.7,y+s*.22],[x-s*.17,y-s*.02],[x+s*.42,y+s*.14]],'#375f5140',2);
          for(let k=0;k<4;k++)seed(x+(rand()-.5)*s,y+(rand()-.5)*s*.4,3+rand()*3,k%2?'#e2d89182':'#d5f3ca85');
          break;
        case 'namek':
          ellipse(c,x,y,s*.83,s*.34,'#235f8040');ellipse(c,x-s*.13,y-s*.04,s*.53,s*.21,'#92dcd465');
          ring(x,y,s*.93,s*.4,'#e8dfaa70',3);for(let k=0;k<5;k++)seed(x-s*.7+k*s*.34,y+s*.23+Math.sin(k*2)*4,4,'#d6f2bb8a');
          break;
        case 'vegeta':
          shard(x,y,s,'#5a353845');stroke([[x-s,y+s*.2],[x-s*.42,y-s*.1],[x+s*.1,y+s*.02],[x+s*.84,y-s*.3]],'#e6a36b76',4);
          stroke([[x-s*.42,y-s*.1],[x-s*.22,y-s*.5],[x+s*.24,y-s*.37]],'#422c394f',2);break;
        case 'future':
          poly(c,[[x-s,y-s*.27],[x+s*.84,y-s*.33],[x+s,y+s*.24],[x-s*.9,y+s*.34]],'#25343d33');
          stroke([[x-s*.9,y],[x-s*.33,y-s*.03],[x+s*.22,y-s*.06]],'#d5d2ae66',3);
          stroke([[x-s*.18,y-s*.27],[x+s*.01,y-s*.08],[x-s*.23,y+s*.18],[x+s*.2,y+s*.35]],'#252e395a',3);break;
        case 'otherworld':
          for(let k=0;k<3;k++){c.strokeStyle=k?'#fff1df68':'#e7b9f36b';c.lineWidth=5-k;c.beginPath();c.arc(x+(k-1)*s*.23,y,s*(.38+k*.13),Math.PI*.15,Math.PI*1.18);c.stroke();}
          ellipse(c,x+s*.4,y-s*.15,5,5,'#f7e3a8a8');break;
        case 'demon':
          stroke([[x-s*.7,y-s*.2],[x-s*.2,y+s*.07],[x+s*.05,y-s*.2],[x+s*.7,y+s*.3]],'#211e2c95',s*.12);
          stroke([[x-s*.7,y-s*.2],[x-s*.2,y+s*.07],[x+s*.05,y-s*.2],[x+s*.7,y+s*.3]],'#e975686c',2);
          for(let k=0;k<3;k++)shard(x+(rand()-.5)*s,y+(rand()-.5)*s*.4,s*.12,'#bc8a8c80');break;
        case 'vampa':
          ellipse(c,x,y,s*.8,s*.31,'#4a4a314e');ring(x,y,s*.77,s*.29,'#d5c48968',2);
          stroke([[x-s*.5,y+s*.14],[x-s*.31,y-s*.21],[x,y-s*.36],[x+s*.27,y-s*.18],[x+s*.48,y+s*.11]],'#d3c69b8c',5);
          for(let k=-1;k<=1;k++)stroke([[x+k*s*.23,y-s*.27],[x+k*s*.19,y+s*.18]],'#dfd2a079',3);break;
        case 'divine':
          ring(x,y,s*.7,s*.3,'#eee9e6a6',4);ring(x,y,s*.42,s*.17,'#8e99d685',2);
          for(let k=0;k<4;k++){const a=k*TAU/4;shard(x+Math.cos(a)*s*.69,y+Math.sin(a)*s*.27,11,'#e4d49c8c');}break;
        case 'arena':
          poly(c,[[x-s*.55,y-s*.42],[x+s*.55,y-s*.42],[x+s*.83,y],[x+s*.55,y+s*.42],[x-s*.55,y+s*.42],[x-s*.83,y]],'#272c3f52');
          stroke([[x-s*.55,y-s*.42],[x+s*.55,y-s*.42],[x+s*.83,y],[x+s*.55,y+s*.42],[x-s*.55,y+s*.42],[x-s*.83,y]],'#a5a9bb80',3,true);
          stroke([[x-s*.22,y-s*.42],[x+s*.05,y],[x-s*.1,y+s*.42]],'#e3dbd24d',2);break;
        case 'yardrat':
          ring(x,y,s*.67,s*.28,'#ead1c590',3);ring(x,y,s*.39,s*.16,'#8472a48f',2);
          for(let k=0;k<6;k++){const a=k*TAU/6;shard(x+Math.cos(a)*s*.61,y+Math.sin(a)*s*.26,10,'#715e9f9c');}break;
        case 'cereal':
          for(let k=-2;k<=2;k++)stroke([[x-s*.8,y+k*11-s*.2],[x-s*.2,y+k*10],[x+s*.8,y+k*12+s*.23]],'#e8d2a05c',2);
          for(let k=0;k<4;k++)seed(x-s*.5+k*s*.34,y+(k%2)*15,5,'#b9c99080');break;
        case 'sadala':
          poly(c,[[x-s*.7,y-s*.25],[x+s*.7,y-s*.25],[x+s*.5,y+s*.25],[x-s*.5,y+s*.25]],'#5a585047');
          for(let k=-2;k<=2;k++)stroke([[x+k*s*.24,y-s*.2],[x+(k-.25)*s*.24,y+s*.18]],'#d8c0926b',2);
          stroke([[x-s*.8,y],[x+s*.8,y]],'#58918d65',3);break;
        case 'champa':
          ring(x,y,s*.7,s*.29,'#e2c8e980',4);ring(x,y,s*.5,s*.19,'#9c85b874',3);
          for(let k=0;k<5;k++){const a=k*TAU/5;ellipse(c,x+Math.cos(a)*s*.62,y+Math.sin(a)*s*.25,7,4,k%2?'#f1d497a0':'#8c8cd2a0');}break;
        case 'tsufuru':
          stroke([[x-s*.8,y+s*.18],[x-s*.34,y+s*.18],[x-s*.34,y-s*.2],[x+s*.15,y-s*.2],[x+s*.15,y+s*.15],[x+s*.7,y+s*.15]],'#2d526573',5);
          stroke([[x-s*.8,y+s*.18],[x-s*.34,y+s*.18],[x-s*.34,y-s*.2],[x+s*.15,y-s*.2],[x+s*.15,y+s*.15],[x+s*.7,y+s*.15]],'#a5e0cb7c',2);
          for(const dx of [-.34,.15,.7])ellipse(c,x+dx*s,y+s*.15,5,5,'#ace9e5a1');break;
        case 'kanassa':
          for(let k=0;k<3;k++)ring(x+(k-1)*s*.26,y+k*7,s*.38,s*.16,k%2?'#e8e6bd64':'#8ed7d36a',2);
          for(let k=0;k<4;k++)stroke([[x+(k-1.5)*s*.25,y+s*.2],[x+(k-1.6)*s*.25,y-s*.1],[x+(k-1.3)*s*.25,y-s*.34]],'#a9d6bc87',3);break;
        case 'konatsu':
          ring(x,y,s*.64,s*.25,'#e9d7ac80',3);ring(x,y,s*.3,s*.12,'#8ebbaa7d',2);
          for(let k=0;k<3;k++)seed(x+(k-1)*s*.35,y-s*.14+(k%2)*s*.22,7,'#8fbb8e9b');break;
        case 'sacred':
          for(let k=0;k<3;k++){const a=k*TAU/3;stroke([[x,y],[x+Math.cos(a)*s*.62,y+Math.sin(a)*s*.27]],'#f0e8bf79',3);}
          ring(x,y,s*.54,s*.22,'#f5e7c872',2);ellipse(c,x,y,5,5,'#fff2d6b8');break;
        case 'zeno':
          poly(c,[[x,y-s*.55],[x+s*.75,y],[x,y+s*.55],[x-s*.75,y]],'#d4d3ed44');
          stroke([[x,y-s*.55],[x+s*.75,y],[x,y+s*.55],[x-s*.75,y]],'#f0e4d4a3',3,true);
          stroke([[x-s*.43,y],[x+s*.43,y],[x,y-s*.31],[x,y+s*.31]],'#90a0d49a',2);break;
        case 'frieza':
          poly(c,[[x-s,y-s*.32],[x+s,y-s*.32],[x+s,y+s*.32],[x-s,y+s*.32]],'#33394758');
          for(let k=-2;k<=2;k++)stroke([[x+k*s*.28-s*.14,y-s*.15],[x+k*s*.28,y],[x+k*s*.28-s*.14,y+s*.15]],'#d2e8ec83',4);
          stroke([[x-s,y-s*.32],[x+s,y-s*.32]],'#8eb5d27b',3);break;
      }
    }
  }
  function siteDetails(c,site,p){
    const type=site.type;
    if(type==='wilderness'||type==='orchard')return;
    c.save();c.translate(site.x,site.y);c.lineJoin='round';
    const line=(pts,color,width=3,close=false)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(close)c.closePath();c.stroke();};
    const oval=(rx,ry,color,width=3)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(0,0,rx,ry,0,0,TAU);c.stroke();};
    if(type==='dojo'||type==='shrine'){
      ellipse(c,0,0,280,190,p[2]+'38');
      oval(270,183,p[3]+'98',5);oval(218,145,p[1]+'9a',3);
      for(let i=0;i<8;i++){const a=i*TAU/8;line([[Math.cos(a)*216,Math.sin(a)*144],[Math.cos(a)*270,Math.sin(a)*180]],p[3]+'aa',4);}
      if(type==='shrine'){oval(84,60,p[3]+'8a',3);line([[0,-118],[106,0],[0,118],[-106,0]],p[3]+'9b',3,true);}
      else line([[-100,0],[100,0]],p[3]+'99',4);
    }else if(type==='fortress'||type==='checkpoint'||type==='outpost'){
      poly(c,[[-300,-155],[300,-155],[340,135],[-340,135]],p[2]+'38');
      line([[-300,-155],[300,-155],[340,135],[-340,135]],p[3]+'87',5,true);
      line([[-220,0],[-75,0]],p[3]+'a5',8);line([[75,0],[220,0]],p[3]+'a5',8);
      for(let i=-3;i<=3;i++)line([[i*76-18,-148],[i*76+18,-105]],p[4]+'9a',5);
    }else if(type==='ruins'||type==='crash'){
      ellipse(c,0,0,310,160,'#1e263b3a');oval(310,160,p[3]+'74',3);
      for(let i=0;i<5;i++){const a=i*TAU/5;line([[Math.cos(a)*65,Math.sin(a)*40],[Math.cos(a+.12)*220,Math.sin(a+.12)*115],[Math.cos(a+.25)*318,Math.sin(a+.25)*168]],p[2]+'a8',4);}
      if(type==='crash')for(let i=-2;i<=2;i++)line([[i*75-22,-65],[i*75+34,75]],p[3]+'70',4);
    }else if(type==='market'){
      poly(c,[[-300,-175],[300,-175],[300,175],[-300,175]],p[3]+'37');
      for(let x=-240;x<=240;x+=80)line([[x,-160],[x,160]],p[2]+'78',2);
      for(let y=-120;y<=120;y+=80)line([[-280,y],[280,y]],p[2]+'78',2);
    }else if(type==='quarry'||type==='canyon'){
      for(let i=0;i<4;i++)oval(300-i*42,180-i*27,p[2]+(i%2?'70':'9a'),7-i);
      line([[-300,-75],[-160,-35],[-80,-80],[5,-15],[140,-65],[300,20]],p[3]+'7a',4);
    }
    c.restore();
  }
  function riverX(y,id){return UZOpenWorld.profile(id).river?UZOpenWorld.riverX(id,y):1e9;}
  function dry(x,y,id){return Math.abs(x-riverX(y,id))>160;}
  function relief(c,o,p,id){
    const {x,y,r,h,phase}=o,points=[];
    for(let i=0;i<18;i++){const a=i/18*TAU,k=1+.1*Math.sin(i*2.6+phase);points.push([x+Math.cos(a)*r*k,y+Math.sin(a)*r*.55*k]);}
    ellipse(c,x+25,y+h*.65,r*1.12,r*.65,'#172a3035');
    poly(c,points.map(([px,py])=>[px,py+h]),p[2]);
    for(let i=0;i<17;i++)if(points[i][1]>y){let a=points[i],b=points[i+1];poly(c,[a,b,[b[0]+7,b[1]+h],[a[0]-4,a[1]+h]],i%3===0?p[3]:p[2]);c.strokeStyle='#372f3e38';c.lineWidth=2;c.beginPath();c.moveTo(a[0],a[1]+8);c.lineTo(a[0]-5,a[1]+h*.85);c.stroke();}
    poly(c,points,p[1]);c.strokeStyle=p[3];c.lineWidth=3;c.beginPath();points.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.closePath();c.stroke();
    ellipse(c,x-r*.2,y-r*.1,r*.52,r*.2,p[0]+'88');
    if(o.snow)poly(c,[[x-r*.5,y],[x-r*.2,y-r*.35],[x+r*.2,y-r*.26],[x+r*.48,y],[x+r*.1,y-r*.05],[x-r*.15,y+r*.1]],'#e3ede0');
    c.save();c.translate(x,y);c.lineWidth=3;
    if(wetRelief.has(id)){
      c.strokeStyle=id==='namek'?'#c8f0dc9c':'#aee5de9c';
      for(let i=0;i<3;i++){c.beginPath();c.ellipse(-r*.12,i*r*.18-r*.18,r*(.31+i*.16),r*(.12+i*.04),0,.1,Math.PI*1.12);c.stroke();}
      ellipse(c,r*.43,-r*.16,8,5,'#e7efbcb0');
    }else if(redRelief.has(id)){
      c.strokeStyle=id==='demon'?'#eda18b91':'#4b343f81';
      for(let i=-2;i<=2;i++){c.beginPath();c.moveTo(i*r*.26,-r*.31);c.lineTo((i+.18)*r*.26,-r*.04);c.lineTo((i-.15)*r*.26,r*.2);c.stroke();}
      poly(c,[[-r*.26,-r*.26],[0,-r*.5],[r*.16,-r*.24]],id==='demon'?'#c9778288':'#e1a47671');
    }else if(industrialRelief.has(id)){
      c.strokeStyle=id==='tsufuru'?'#b9e6cd82':'#aab8cb86';
      for(let i=-1;i<=1;i++){c.strokeRect(-r*.54+i*r*.36,-r*.18,r*.26,r*.26);c.beginPath();c.moveTo(-r*.41+i*r*.36,r*.08);c.lineTo(-r*.41+i*r*.36,r*.25);c.stroke();}
    }else if(celestialRelief.has(id)){
      c.strokeStyle=id==='zeno'?'#f3e4ecb0':'#f5e8c195';
      c.beginPath();c.ellipse(0,-r*.05,r*.63,r*.26,0,Math.PI*.1,Math.PI*.9);c.stroke();
      c.beginPath();c.ellipse(0,-r*.04,r*.36,r*.14,0,0,TAU);c.stroke();
    }else if(id==='yardrat'||id==='arena'){
      c.strokeStyle=id==='yardrat'?'#eac2d3a0':'#ccd1db9e';
      c.beginPath();c.ellipse(0,0,r*.5,r*.22,0,0,TAU);c.stroke();
      for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(i*r*.27,-r*.26);c.lineTo(i*r*.27,r*.26);c.stroke();}
    }else{
      c.strokeStyle=p[3]+'85';
      for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(-r*.52,r*(i*.13-.06));c.quadraticCurveTo(0,r*(i*.13-.21),r*.55,r*(i*.13-.04));c.stroke();}
    }
    c.restore();
  }
  function house(c,o,p){
    const {x,y,size:s}=o,kind=p[5];c.save();c.translate(x,y);
    ellipse(c,9,15,s*1.12,s*.68,'#18253140');
    if(kind==='shell'||kind==='capsule'){
      ellipse(c,0,2,s,s*.67,'#7daca8');ellipse(c,0,-6,s,s*.64,'#e0eee0');
      ellipse(c,-s*.18,-s*.24,s*.6,s*.29,'#f4f2dd');
      for(let i=-2;i<=2;i++){c.strokeStyle='#9fc2b8';c.lineWidth=2;c.beginPath();c.ellipse(i*s*.12,-5,s*(.68-Math.abs(i)*.08),s*.52,0,Math.PI,TAU);c.stroke();}
      for(const side of [-1,1])ellipse(c,side*s*.6,4,s*.12,s*.14,'#354e82');
      ellipse(c,0,s*.42,s*.18,s*.17,'#436779');
      if(kind==='shell'){poly(c,[[s*.65,-s*.34],[s*.8,-s*.86],[s*.92,-s*.22]],'#e5e8c8');}
    }else if(kind==='cottage'){
      c.fillStyle='#ddc9a0';c.fillRect(-s*.8,-s*.3,s*1.6,s);poly(c,[[-s,-s*.22],[0,-s*.9],[s,-s*.22],[0,s*.32]],'#9d5b49');
      poly(c,[[0,-s*.9],[s,-s*.22],[0,s*.32]],'#ca8060');
      for(let i=1;i<5;i++){c.strokeStyle='#f0bb793e';c.beginPath();c.moveTo(-s+i*s*.2,-s*.22-i*s*.14);c.lineTo(i*s*.2,s*.32-i*s*.14);c.stroke();}
      c.fillStyle='#516478';c.fillRect(-s*.56,s*.28,s*.25,s*.2);c.fillRect(s*.3,s*.28,s*.25,s*.2);c.fillStyle='#705345';c.fillRect(-s*.13,s*.33,s*.26,s*.37);
    }else if(kind==='spire'||kind==='temple'){
      ellipse(c,0,0,s,s*.65,p[3]);poly(c,[[-s*.7,0],[0,-s*1.2],[s*.7,0],[0,s*.35]],kind==='temple'?'#e4d7bc':'#baa1bd');
      poly(c,[[0,-s*1.2],[s*.7,0],[0,s*.35]],p[2]);ellipse(c,0,10,s*.2,s*.14,'#413d65');
      c.strokeStyle='#efcc7e';c.lineWidth=4;c.beginPath();c.moveTo(-s*.65,0);c.lineTo(0,s*.36);c.lineTo(s*.65,0);c.stroke();
    }else if(kind==='wild'){
      poly(c,[[-s,s*.4],[-s*.5,-s*.6],[s*.4,-s*.7],[s,s*.4]],p[3]);ellipse(c,0,s*.2,s*.45,s*.32,'#353c31');
    }else{
      c.fillStyle=p[2];c.fillRect(-s,-s*.45,s*2,s*1.15);poly(c,[[-s,-s*.45],[-s*.7,-s*.8],[s*.7,-s*.8],[s,-s*.45],[s*.7,s*.3],[-s*.7,s*.3]],p[3]);
      c.fillStyle='#344551';c.fillRect(-s*.18,s*.3,s*.36,s*.4);
      for(const a of [-.64,.46]){c.fillStyle=kind==='ruin'?'#343c43':'#70d6d2';c.fillRect(a*s,s*.36,s*.2,5);}
      if(kind==='fort'){ellipse(c,0,-s*.24,s*.4,s*.3,'#778c9c');c.strokeStyle='#344856';c.lineWidth=5;c.beginPath();c.moveTo(0,-s*.2);c.lineTo(s*.7,-s*.7);c.stroke();}
    }c.restore();
  }
  function tree(c,o,p,t,id){
    const sway=Math.sin(t*1.5+o.x*.013)*2.4,s=o.size;
    ellipse(c,o.x+8,o.y+14,s*.85,s*.44,'#182d3035');
    c.strokeStyle=id==='namek'?'#cfcea0':'#756143';c.lineWidth=id==='namek'?5:7;c.beginPath();c.moveTo(o.x,o.y+10);c.quadraticCurveTo(o.x+sway,o.y-s*.4,o.x+sway,o.y-s);c.stroke();
    if(id==='namek'){ellipse(c,o.x+sway,o.y-s,s*.66,s*.58,'#2a527d');ellipse(c,o.x+sway-3,o.y-s-5,s*.53,s*.43,'#4386bb');ellipse(c,o.x+sway-8,o.y-s-10,s*.25,s*.19,'#69b7d1');}
    else{for(let i=0;i<3;i++)ellipse(c,o.x+sway+(i-1)*s*.33,o.y-s*.45-i*s*.23,s*(.75-i*.12),s*(.55-i*.1),[p[0],p[1],id==='earth'?'#a4ba72':p[1]][i]);}
  }
  function build(id,cx,cy){
    const chunk=UZOpenWorld.chunk(id,cx,cy),rand=UZ.rng(UZOpenWorld.hash(id,cx,cy)^7813),p=themes[id]||themes.demon;
    const mountains=[],houses=[],grass=[];
    for(let i=0;i<7;i++){const x=chunk.x+rand()*S,y=chunk.y+rand()*S,r=85+rand()*100;
      if(Math.hypot(x-1700,y-1740)>650&&Math.hypot(x-chunk.site.x,y-chunk.site.y)>750&&Math.abs(x-riverX(y,id))>r+170)mountains.push({x,y,r,h:35+rand()*85,phase:rand()*6,snow:id==='earth'&&rand()<.22});}
    for(const prop of chunk.props)houses.push({...prop,kind:"prop"});
    for(let i=0;i<100;i++){const x=chunk.x+rand()*S,y=chunk.y+rand()*S;if(dry(x,y,id))grass.push({x,y,size:3+rand()*6});}
    const canvas=document.createElement('canvas');canvas.width=canvas.height=(S+PAD*2)/2;const g=canvas.getContext('2d');g.scale(.5,.5);g.translate(PAD-chunk.x,PAD-chunk.y);
    for(let i=0;i<24;i++){const x=chunk.x+rand()*S,y=chunk.y+rand()*S,r=100+rand()*210,grad=g.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,p[1]+'40');grad.addColorStop(1,p[1]+'00');g.fillStyle=grad;g.fillRect(x-r,y-r,r*2,r*2);}
    groundDetails(g,id,chunk,p,rand);
    siteDetails(g,chunk.site,p);
    return {chunk,p,canvas,mountains,houses,grass};
  }
  Art.openTerrain=(c,renderer,me,t,width,height)=>{
    const {x,y}=renderer.cam,id=renderer.world,p=themes[id]||themes.demon,clock=renderer.reduced?0:t;
    const visible=(o,pad=180)=>Math.abs(o.x-x)<width/2+pad&&Math.abs(o.y-y)<height/2+pad;
    c.save();c.fillStyle=p[0];c.fillRect(x-width/2-10,y-height/2-10,width+20,height+20);
    const entries=[];
    for(let cy=Math.floor((y-height/2-PAD)/S);cy<=Math.floor((y+height/2+PAD)/S);cy++)for(let cx=Math.floor((x-width/2-PAD)/S);cx<=Math.floor((x+width/2+PAD)/S);cx++){
      const key=`${id}:${cx}:${cy}`;if(!cache.has(key)){cache.set(key,build(id,cx,cy));if(cache.size>16)cache.delete(cache.keys().next().value);}
      const e=cache.get(key);entries.push(e);c.drawImage(e.canvas,cx*S-PAD,cy*S-PAD,S+PAD*2,S+PAD*2);
    }
    // A world-coordinate river never terminates at streaming boundaries.
    c.lineJoin='round';c.lineCap='round';const start=Math.floor((y-height/2-400)/70)*70,end=y+height/2+400;
    for(const [color,w]of [[p[3],156],[p[4],128],['#b7ead427',95]]){c.strokeStyle=color;c.lineWidth=w;c.beginPath();for(let py=start;py<end;py+=70){const px=riverX(py,id);py===start?c.moveTo(px,py):c.lineTo(px,py);}c.stroke();}
    c.lineWidth=1.5;c.strokeStyle='#c4eee675';
    for(let py=start;py<end;py+=58){const fy=py+(clock*30)%58,rx=riverX(fy,id);if(Math.abs(rx-x)>width/2+100)continue;c.beginPath();c.ellipse(rx+Math.sin(py)*28,fy,12,3,0,0,Math.PI);c.stroke();}
    for(const e of entries){
      c.strokeStyle=p[1];c.lineWidth=1;c.beginPath();
      for(const g of e.grass)if(visible(g,20)){const sway=Math.sin(clock*2+g.x*.018+g.y*.01)*3;c.moveTo(g.x-3,g.y);c.quadraticCurveTo(g.x-5+sway,g.y-5,g.x-3+sway,g.y-g.size);c.moveTo(g.x,g.y);c.lineTo(g.x+sway+2,g.y-g.size-2);}c.stroke();
      for(const g of e.grass)if(visible(g,20)&&(g.x|0)%7===0)ellipse(c,g.x+4,g.y-g.size,2,2,id==='namek'?'#d3e9b2':'#e3cc8d');
      const site=e.chunk.site;if(visible(site,650)&&e.houses.length){
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
      }
    }
    const objects=[];
    for(const e of entries){for(const o of e.mountains)if(visible(o,320))objects.push({...o,kind:'mountain'});for(const o of e.houses)if(visible(o))objects.push({...o,kind:o.kind||'house'});for(const o of e.chunk.objects)if(visible(o)&&dry(o.x,o.y,id)&&!e.mountains.some(m=>Math.hypot(o.x-m.x,(o.y-m.y)*1.5)<m.r+20)&&!e.houses.some(h=>Math.hypot(o.x-h.x,o.y-h.y)<90))objects.push(o);}
    const ruined=new Set((me?.debris||[]).map(o=>o.id));
    for(let i=objects.length-1;i>=0;i--){const o=objects[i],key=id+':'+o.kind+':'+Math.round(o.x)+':'+Math.round(o.y);if(ruined.has(key))objects.splice(i,1);}
    for(const d of me?.debris||[]){if(!visible(d))continue;ellipse(c,d.x,d.y,d.radius,d.radius*.6,'#29343b77');for(let i=0;i<7;i++){const a=i*2.4,rx=d.x+Math.cos(a)*d.radius*.7,ry=d.y+Math.sin(a)*d.radius*.4;poly(c,[[rx-9,ry+5],[rx-4,ry-8],[rx+12,ry+3]],p[2]);}}
    objects.sort((a,b)=>a.y-b.y);
    for(const o of objects){if(globalThis.UZWorldKit?.terrain(c,o,id,clock))continue;if(o.kind==='mountain')relief(c,o,p,id);else if(o.kind==='house')house(c,o,p);else if(o.kind==='tree')tree(c,o,p,clock,id);else {ellipse(c,o.x+4,o.y+5,o.size,o.size*.55,'#20333b30');poly(c,[[o.x-o.size,o.y],[o.x-o.size*.4,o.y-o.size*.7],[o.x+o.size*.4,o.y-o.size*.5],[o.x+o.size,o.y+7]],p[2]);}}
    globalThis.UZWorldKit?.dress(c,entries,id,clock,visible,me);
    // Cascades repeat along the continuous river, with flowing streaks and spray.
    for(let k=Math.floor(start/2200);k<=Math.ceil(end/2200);k++){
      const fy=k*2200+600,fx=riverX(fy,id);if(!visible({x:fx,y:fy},180))continue;
      poly(c,[[fx-76,fy-28],[fx+76,fy-28],[fx+88,fy+68],[fx-88,fy+68]],p[2]);
      c.fillStyle='#b0e1d7';c.fillRect(fx-53,fy-25,106,94);c.fillStyle='#76b4bc';c.fillRect(fx-44,fy-25,30,94);
      for(let j=0;j<16;j++){const yy=fy-25+((j*19+clock*95)%94);c.strokeStyle=j%2?'#efffefaa':'#d2fff070';c.lineWidth=2;c.beginPath();c.moveTo(fx-48+j*6,yy);c.lineTo(fx-48+j*6,Math.min(fy+69,yy+18));c.stroke();}
      for(let j=0;j<7;j++)ellipse(c,fx-55+j*18,fy+70+Math.sin(clock*3+j)*4,18,7,'#dff5e478');
    }
    for(const e of entries){const site=e.chunk.site;if(e.chunk.props.length&&visible(site,180)){c.fillStyle='#e8e0c4b0';c.textAlign='center';c.font='600 12px system-ui';c.fillText(site.name,site.x,site.y-260);}}
    for(const r of UZOpenWorld.regions(id))if(visible(r,200)){c.fillStyle='#f4efcaaa';c.font='600 14px system-ui';c.textAlign='center';c.fillText(r.name,r.x,r.y-210);}
    c.restore();
  };
  const update=FlightUI.update;
  FlightUI.update=p=>{update(p);if(p.region&&p.world!=='space'&&!p.ascent&&p.altitude<.1)document.getElementById('flight-status').textContent=`${p.region.name} · Nível ${p.region.level}+ · ${p.mode==='ground'?'Solo':'Céu'}`;};
})();
