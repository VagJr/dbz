/* Rounded, cel-shaded miniatures. Local +Y is forward; crown occludes the
   shoulders and the face occupies only the leading rim of the head. */
(() => {
  const ink = '#26303c';
  const colors = {gold:'#ffe071',blue:'#65dbef',silver:'#edf5ff',violet:'#e4dcff',purple:'#ae85e7',green:'#bbed72',black:'#dfb7e7'};
  const shade = (hex, n) => '#' + [1,3,5].map(i => Math.max(0,Math.min(255,parseInt(hex.slice(i,i+2),16)+n)).toString(16).padStart(2,'0')).join('');
  const hairPaths = {
    spike:'M-13 2 Q-17-2-20-3 L-12-7 Q-19-10-21-12 Q-13-15-7-11 L-13-22 Q-2-22 4-13 L8-19 L10-11 Q17-13 19-9 L14-4 L20-2 L12 4 L8 1 L5 6 L3 0 L-2 5 L-3 0 L-9 5 Z',
    crest:'M-12 4 Q-17-4-14-12 L-9-7 Q-11-17-5-23 L-1-15 L4-27 Q12-20 11-11 L16-16 Q19-4 12 5 L7 1 Q3-2 0 4 Q-4-2-8 1 Z',
    short:'M-13 3 L-16-4 L-11-6 L-15-12 L-5-10 L-7-17 L1-13 L6-18 L9-10 L15-11 L13-4 L16-1 L10 4 L6 0 L2 4 L0 0 L-5 4 L-7 0 Z',
    wild:'M-13 4 L-21 0 L-15-6 L-22-10 L-12-12 L-16-21 L-5-16 L-3-27 L4-18 L10-24 L12-13 L21-17 L16-7 L23-3 L14 3 L9 1 L6 6 L2 1 L-3 5 L-6 1 Z',
    part:'M-13 8 Q-18-1-14-10 Q-9-18 0-15 Q10-18 15-9 Q18 1 13 8 L10 3 L8-5 Q4-2 0 0 L2-9 Q-3-2-10 2 L-10 7 Z',
    bob:'M-13 9 Q-18-2-13-11 Q-5-19 6-14 Q18-10 16 3 L14 10 L10 9 L10-3 L4 1 L2-6 L-2 0 L-8 2 L-9 9 Z',
    mane:'M-14 5 L-20-3 L-16-8 L-23-15 L-15-15 L-18-24 L-7-20 L-6-29 L3-21 L9-27 L12-19 L20-21 L16-12 L23-9 L17-3 L17 7 L11 4 L7 1 L3 5 L0 0 L-7 4 Z',
    pony:'M-13 5 Q-17-3-12-12 Q-4-18 7-13 Q17-8 14 5 L9 3 L8-5 L3-1 L0-6 L-5 0 L-10 1 Z',
    braid:'M-13 5 Q-17-3-12-12 Q-4-18 7-13 Q17-8 14 5 L9 3 L8-5 L3-1 L0-6 L-5 0 L-10 1 Z',
    bun:'M-13 5 Q-17-3-12-12 Q-4-18 7-13 Q17-8 14 5 L9 3 L8-5 L3-1 L0-6 L-5 0 L-10 1 Z'
  };
  const paths = Object.fromEntries(Object.entries(hairPaths).map(([k,v])=>[k,new Path2D(v)]));
  function fighter(c,e,t,scale=1) {
    const meta=UZ.CHARACTERS.find(ch=>ch.id===e.skin), d=Art.personalDesign(UZDesigns[e.skin]||UZDesigns[meta?.skin]||UZDesigns.soldier,e);
    const f=new Set(d.flags), form=e.form||meta?.form, hair=d.hair?(colors[form]||d.hair):null;
    const state=e.state||'idle', reduced=Art.reduceMotion===true, time=reduced?0:t;
    const flight=e.mode==='flight'||(e.mode!=='ground'&&['fly','glide','boost'].includes(state));
    const walk=state==='run', guard=state==='guard', charge=['charge','chargeAim','meleeCharge'].includes(state), hit=!!(e.combatAction&&!['ki','charged','weave'].includes(e.combatAction.key))||state==='attack'||e.clashType==='fists', blast=!!(e.combatAction&&['ki','charged','weave'].includes(e.combatAction.key))||state==='blast'||e.clashType==='beam';
    const beat=Math.sin(time*14), breath=Math.sin(time*3)*.35;
    // Anticipation, fast extension, brief contact, then a slower recovery.
    const cycle=reduced?.42:(time*(e.clashType==='fists'?10:2.8))%1;
    const rush=state==='rush'||(hit&&cycle<.22&&Math.hypot(e.vx||0,e.vy||0)>(flight?500:260));
    const boost=e.boosting||state==='boost'||rush;
    const ease=v=>v*v*(3-2*v);
    const m=e.combatAction, clock=e.combatClock||0;
    const punch=m?(clock<m.impact?-.22*ease(Math.max(0,Math.min(1,(clock-m.start)/(m.impact-m.start)))):clock<m.activeEnd?1:1-ease(Math.max(0,Math.min(1,(clock-m.activeEnd)/(m.end-m.activeEnd))))):cycle<.22?-.22*ease(cycle/.22):cycle<.38?ease((cycle-.22)/.16):cycle<.48?1:1-ease((cycle-.48)/.52);
    const motion=m?.motion, pose=motion?.pose||((e.combo===3)?'roundhouse':(e.combo===2)?'cross':'jab');
    const strikeSide=motion?.side||((e.combo||1)%2?1:-1);
    const reach=Math.max(0,punch), kick=['roundhouse','airSpin','airKnee'].includes(pose);
    const movingStrike=hit&&motion?.moving, driving=hit&&pose==='lunge';
    const twist=hit?strikeSide*(punch*(['hook','slipHook','airSpin'].includes(pose)?.65:.32)-.10):guard?-.12:blast?.12:walk?beat*.025:0;
    const tilt=flight?.72:hit?(driving?.62:.32)+reach*(pose==='uppercut'?.12:.25):guard?.32:charge?.28:blast?.62:state==='stun'?.55:.04;
    const size=f.has('small')?.84:f.has('giant')?1.42:1, width=f.has('wide')?1.22:f.has('large')?1.15:f.has('slim')?.92:1;
    const bare=['bare','alien','majin','animal','dragon'].includes(d.rig), suit=bare?d.skin:d.cloth;
    function ellipse(x,y,rx,ry,color,edge=ink,lw=1.7){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill();if(edge){c.strokeStyle=edge;c.lineWidth=lw;c.stroke();}}
    function shape(svg,color,edge=ink,lw=1.7){const p=typeof svg==='string'?new Path2D(svg):svg;c.fillStyle=color;c.fill(p);if(edge){c.strokeStyle=edge;c.lineWidth=lw;c.stroke(p);}}
    function stroke(points,color,lw){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=lw;c.stroke();}
    function limb(points,color,lw){
      // Tapered upper/lower segments keep an elbow and a wrist, not bead joints.
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
        const nx=-dy/len,ny=dx/len,w=lw*(i===1?.56:.48),tip=lw*(i===points.length-1?.33:.47);
        shape(`M${a[0]+nx*w} ${a[1]+ny*w} L${b[0]+nx*tip} ${b[1]+ny*tip} L${b[0]-nx*tip} ${b[1]-ny*tip} L${a[0]-nx*w} ${a[1]-ny*w}Z`,color,ink,1.25);
        stroke([[a[0]+nx*w*.45,a[1]+ny*w*.45],[b[0]+nx*tip*.4,b[1]+ny*tip*.4]],shade(color,22),1);
      }
    }
    c.save();c.translate(e.x||0,e.y||0);c.scale(scale*.69*size,scale*.69*size);c.lineJoin='round';c.lineCap='round';
    ellipse(0,6,21*width,11,'#020b1940',null);
    if(charge||form){c.save();c.globalCompositeOperation='lighter';const aura=colors[form]||'#70dbfa';const r=32+(e.chargeRatio||.5)*12;const g=c.createRadialGradient(0,0,7,0,0,r);g.addColorStop(0,aura+'42');g.addColorStop(1,aura+'00');c.fillStyle=g;c.fillRect(-r,-r,r*2,r*2);for(let i=0;i<3;i++){const a=time*2+i*2.1;stroke([[Math.cos(a)*23,Math.sin(a)*18],[Math.cos(a)*29,Math.sin(a)*26]],aura,1.2);}c.restore();}
    c.rotate((e.angle||0)-Math.PI/2+twist+(state==='stun'?Math.sin(time*35)*.07:0));c.scale(width,1);
    if(flight){
      c.translate(0,hit?Math.max(0,punch)*3:Math.sin(time*4)*.7);
      if(hit)c.rotate(strikeSide*punch*.13);
      if(state==='stun')c.rotate(Math.sin(time*6)*.2);
    }else if(hit){c.translate(strikeSide*punch*1.4,punch*1.6);}
    if(rush||driving){c.scale(1,flight?1.12:.90);c.translate(0,3);}
    if(hit&&['airSpin','roundhouse'].includes(pose))c.rotate(strikeSide*reach*.65);
    if(hit&&pose==='uppercut')c.translate(0,reach*4);
    if(hit&&pose==='meteor'){c.scale(1,1-reach*.13);c.translate(0,reach*5);}
    if(hit&&!reduced&&(driving||motion?.airborne||pose==='slipHook')){
      c.save();c.globalAlpha=.22;for(let i=1;i<=3;i++)stroke([[-10-i*3,-8-i*6],[strikeSide*8,-14-i*7]],form?'#ffdd7c':'#a9eeff',2);c.restore();
    }
    if(d.rig==='serpent'){
      const body=Array.from({length:23},(_,i)=>[Math.sin(i*.42-time*(hit?12:2))*(5+i*.4+(hit?reach*4:0)),12-i*3]);
      limb(body,d.skin,11);
      stroke(body.map(([x,y])=>[x+2,y]),d.trim,3);
      for(let i=3;i<21;i+=3){const [x,y]=body[i];shape(`M${x-4} ${y} L${x-10} ${y-5} L${x-3} ${y-6}Z`,d.trim);}
      ellipse(0,14,12,10,d.skin);ellipse(0,21,9,5,d.trim);
      for(const s of [-1,1]){shape(`M${s*7} 10 Q${s*19} 0 ${s*12}-5 L${s*10} 5Z`,'#e7d8a8');ellipse(s*5,18,2,1.5,'#ffe079');stroke([[s*7,23],[s*18,27],[s*23,22]],d.trim,1.2);}
      c.restore();return;
    }
    // Rear silhouette and accessories remain below the head and shoulders.
    if(f.has('tail')){c.beginPath();c.moveTo(0,-9);c.bezierCurveTo(-28,-19,-33,7+beat*2,-22,6);c.strokeStyle=ink;c.lineWidth=6;c.stroke();c.strokeStyle=d.rig==='armor'?'#a07b52':d.skin;c.lineWidth=3.5;c.stroke();}
    if(f.has('cape')||['coat','angel'].includes(d.rig)){const cape=f.has('namek')?'#efeddb':d.trim;shape(`M-12 3 Q-22-3-22-21 L-12 ${-26+beat} Q0-22 12 ${-26-beat} L22-21 Q22-3 12 3 Z`,cape);shape('M-12 0 L-15-20 L-5-18 L0-24 L4-16 L14-20 L12 0Z',shade(cape,-22),null);}
    if(f.has('carapace')||f.has('wings'))for(const s of [-1,1]){c.save();c.scale(s,1);shape('M7 3 Q22-2 21-25 Q12-24 4-8Z',f.has('wings')?d.skin:'#273341');c.restore();}
    if(f.has('sword')){limb([[-15,-20],[15,16]],'#b8c7d4',3);stroke([[9,14],[16,8]],'#e6bb6b',3);limb([[15,16],[19,21]],'#6d544d',3);}
    if(f.has('staff'))limb([[-25,-23],[-25,24]],'#9c7549',2.4);
    if(f.has('pelt'))shape('M-13-7 L-19-13 L-15-19 L-8-16 L0-21 L7-16 L14-19 L18-12 L12-7Z',d.trim);
    for(const s of [-1,1]){
      const gait=walk||movingStrike?Math.sin(time*(movingStrike?23:14)+s*Math.PI/2):0;
      let foot=[s*7,-10-gait*2.4],knee=[s*6,-7];
      if(flight){foot=[s*5,-29+(boost?0:beat*s*.7)];knee=[s*5,-19];}
      if(state==='dash'){foot=[s*10,-19+s*4];knee=[s*9,-11];}
      if(guard||charge)foot=[s*11,-15];
      if(flight&&(guard||charge)){knee=[s*8,-14];foot=[s*6,-23+s*2];}
      if(hit&&!kick){
        if(flight){knee=[s*7,-17];foot=[s*6,-28+s*punch*3];}
        else{knee=[s*8,-7];foot=[s*10,-12+(s===strikeSide?-punch*3:punch*4)];}
      }
      if(hit&&kick&&s===strikeSide){
        if(pose==='airKnee'){knee=[s*9,1+16*reach];foot=[s*8,-9+18*reach];}
        else {const sweep=pose==='airSpin'?Math.sin(reach*Math.PI*.7):reach;knee=[s*(12-9*sweep),-3+14*reach];foot=[s*(23-24*sweep),-7+43*reach];}
      }
      if(movingStrike&&!kick){foot[1]+=gait*3;knee[0]+=gait*2;}
      if(hit&&pose==='retreatJab'){knee=[s*9,-11];foot=[s*13,-19-reach*3];}
      if(driving){knee=[s*7,-9+s*4];foot=[s*10,-18+s*8];}
      if(state==='stun')foot=[s*13,-19];
      if(rush){knee=[s*7,-13];foot=[s*6,flight?-31:-14-s*beat*4];}
      limb([[s*5,-7],knee,foot],d.cloth,8);
      ellipse(foot[0],foot[1],4.5,3.7,d.rig==='armor'?'#f1eddf':d.trim);
      stroke([[foot[0]-2,foot[1]+1],[foot[0]+1,foot[1]+1]],'#ffffff65',1.2);
    }
    // Short arms pivot from under one continuous shoulder mass.
    const hands=[];
    for(const s of [-1,1]){
      if(f.has('onearm')&&s===1)continue;
      let elbow=[s*16,1],hand=[s*17,5+(walk?beat*s*4:breath)];
      if(flight){elbow=[s*(state==='glide'?19:15),-6];hand=[s*(state==='glide'?24:14),boost?-17:-11];}
      if(state==='dash'){elbow=[s*17,-3+s*4];hand=[s*20,-7+s*6];}
      if(guard){elbow=[s*16,10];hand=[s*9,18];}
      if(charge){elbow=[s*18,2];hand=[s*(state==='chargeAim'?8:19),state==='chargeAim'?19:9];}
      if(flight&&guard){elbow=[s*15,11];hand=[s*8,24];}
      if(flight&&charge){elbow=[s*16,4];hand=[s*(state==='chargeAim'?6:15),state==='chargeAim'?24:12];}
      if(blast){elbow=[s*13,14];hand=[s*7,27];}
      if(hit){
        if(s===strikeSide&&!kick){
          elbow=[s*(17-8*punch),3+14*punch];
          hand=e.combo===2?[s*(22-22*punch),8+22*punch]:[s*(15-10*punch),8+29*punch];
        }else{elbow=[s*15,2];hand=[s*9,12];}
      }
      if(hit){
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
      if(state==='stun'){elbow=[s*19,0];hand=[s*23,5];}
      if(rush){elbow=[s*11,flight?18:7];hand=[s*5,flight?32:18];}
      limb([[s*10,2],elbow,hand],d.skin,6.5);
      if(!bare)shape(`M${s*8} 6 L${s*14} 6 L${s*17} 1 L${s*13}-3 L${s*8}-1Z`,d.cloth);
      if(f.has('namek'))stroke([elbow,[elbow[0],elbow[1]+3]],'#d39698',3);
      hands.push([hand,s]);
    }
    shape('M-15 5 L-16 0 L-11-7 L-9-12 L0-14 L9-12 L11-7 L16 0 L15 5 L8 9 L-8 9Z',suit);
    shape('M7 7 Q14 3 12-7 Q9-13 0-13 L-7-12 Q5-11 6-4Z',shade(suit,-24),null);
    if(['gi','robe','kai'].includes(d.rig)){shape('M-8 6 L0-3 L8 6 L5 8 L0 3 L-5 8Z',d.trim,null);stroke([[-11,-9],[0,-11],[11,-9]],d.trim,4);stroke([[-8,-8],[4,-10]],shade(d.trim,25),1);}
    if(d.rig==='armor'){shape('M-12 5 L-8 8 L-6 4 L6 4 L8 8 L12 5 L10-7 Q0-12-10-7Z','#eeecdf');shape('M-7 2 L7 2 L7-6 Q0-9-7-6Z',d.trim,null);for(let y=-5;y<2;y+=3)stroke([[-6,y],[6,y]],shade(d.trim,-26),.8);}
    if(['jacket','coat','vest'].includes(d.rig)){stroke([[0,6],[0,-10]],d.trim,3);for(const s of [-1,1])shape(`M${s*2} 7 L${s*10} 5 L${s*6}-1Z`,shade(d.cloth,25),null);}
    if(['god','angel'].includes(d.rig)){shape('M-11 6 L0 9 L11 6 L7-5 L0-9 L-7-5Z','#304563');shape('M0 2 L4-2 L0-6 L-4-2Z',d.trim,null);}
    if(d.rig==='robot'){shape('M-9 5 L9 5 L10-7 L-10-7Z',d.trim);for(let y=-5;y<4;y+=3)stroke([[-6,y],[6,y]],'#405262',1);}
    if(f.has('shell')){ellipse(0,-7,13,10,'#a17d50');shape('M-5 0 L5 0 L8-6 L3-12 L-5-12 L-8-6Z','#b99a63','#70593e',1);}
    if(f.has('spots'))for(const [x,y] of [[-8,0],[8,-3],[-5,-7],[5,4]])ellipse(x,y,1,1.6,'#253b34',null);
    if(f.has('emblem')){ellipse(-7,-2,3,3,'#f7eedb',ink,.7);stroke([[-8,-3],[-6,-3],[-7,-1]],ink,.65);}
    if(f.has('rr')){shape('M-10-3 L-5-3 L-5 0 L-10 0Z','#d85656',null);}
    if(f.has('rivets'))for(const s of [-1,1])ellipse(s*8,-5,1.1,1.1,'#edf2e8',null);
    if(d.rig==='majin'){stroke([[-10,-9],[0,-11],[10,-9]],'#252936',4);ellipse(0,-11,4,2.6,'#e9c761');stroke([[-2,-12],[-2,-10],[0,-11],[2,-10],[2,-12]],ink,.7);}
    if(f.has('scarf')){stroke([[-10,6],[0,3],[10,6]],d.trim,4);shape('M10 5 Q20 0 18-12 L13-8 L7 3Z',d.trim);}
    // Prone flight exposes the back, never the chest opening or facial plane.
    if(flight){
      shape('M-13 5 L-14 0 L-10-8 L-8-14 L0-16 L8-14 L10-8 L14 0 L13 5 L7 9 L-7 9Z',suit);
      shape('M1 7 L9 4 L10-3 L7-12 L1-14 L3-4Z',shade(suit,-24),null);
      stroke([[-9,2],[-6,-4],[-6,-9]],shade(suit,23),1.2);
      stroke([[-8,-12],[0,-14],[8,-12]],d.trim,3);
      if(d.rig==='armor'){
        shape('M-11 4 L-7 7 L7 7 L11 4 L8-10 L-8-10Z','#e3e5da');
        shape('M-6 3 L6 3 L6-7 L-6-7Z',d.trim,null);
        stroke([[-5,-2],[5,-2]],shade(d.trim,-25),1);
      }
      if(f.has('emblem')){ellipse(0,-3,4.2,4.2,'#f1e9d6',ink,.8);stroke([[-2,-4],[2,-4],[0,-2],[0,-5]],ink,.8);}
    }
    // Head projection: wide crown, compressed face along the forward edge.
    if(flight){
      c.save();c.translate(0,13+breath*.4);c.scale(.78,.85);
      const crown=f.has('turban')?'#efefde':f.has('cap')?d.cloth:hair||d.skin;
      if(hair){
        // Hair spikes trail behind the crown while the forehead points forward.
        shape(paths[d.cut]||paths.short,hair);
      }
      shape('M-11-6 Q-14 1-10 9 Q-6 14 0 15 Q7 14 11 8 Q14 1 10-6 Q0-12-11-6Z',crown);
      shape('M-9-4 Q-12 4-6 10 L-3 11 Q-7 3-4-5Z',shade(crown,18),null);
      if(hair)stroke([[3,-5],[6,2],[4,10]],shade(hair,13),1.2);
      if(f.has('gem'))ellipse(0,3,7,8,d.trim);
      if(f.has('turban')){stroke([[-10,0],[10,3]],'#bdc6b7',1.4);stroke([[-9,5],[8,8]],'#bdc6b7',1);}
      if(f.has('namek')||f.has('pointed'))for(const s of [-1,1])shape(`M${s*10} 0 L${s*18} 4 L${s*11} 6Z`,d.skin);
      if(f.has('ears')||f.has('horns'))for(const s of [-1,1])shape(`M${s*8} 3 L${s*14} 15 L${s*12}-2Z`,f.has('horns')?'#e9dcb6':d.skin);
      if(f.has('antenna')||f.has('namek'))stroke([[0,9],[2,17],[4,18]],d.skin,2);
      c.restore();
    }else{
    c.save();c.translate(hit?strikeSide*punch*1.5:0,5+tilt*6+breath);c.scale(.76,-(.62+tilt*.22));
    if(['pony','braid','bun'].includes(d.cut)&&hair){if(d.cut==='bun')ellipse(0,-17,6,5,hair);else limb([[0,-12],[5,-20],[2,-27]],hair,d.cut==='braid'?5:8);}
    for(const s of [-1,1]){
      if(f.has('pointed')||f.has('namek'))shape(`M${s*10}-1 L${s*21}-5 Q${s*18} 6 ${s*11} 6Z`,d.skin);
      else if(f.has('ears'))shape(`M${s*8}-6 Q${s*12}-28 ${s*17}-21 L${s*15} 1Z`,d.skin);
      else ellipse(s*13,4,3,3.5,d.skin);
    }
    shape('M-13-7 Q-9-15 0-15 Q10-15 13-7 L13 7 Q12 15 0 16 Q-12 15-13 7Z',d.skin);
    shape('M-12-7 Q-9-12-5-12 Q-12 3-7 11 L-1 15 Q-11 15-12 8Z',shade(d.skin,-22),null);
    if(hair){const p=paths[d.cut]||paths.short;shape(p,hair);c.save();c.clip(p);shape('M-18-13 Q-9-19 1-11 Q-9-13-14-5Z',shade(hair,22),null);shape('M6-20 Q10-10 7-3 L11-7Z',shade(hair,14),null);c.restore();}
    if(d.rig==='cell') {shape('M-12 5 L-15-18 L-7-13 L0-18 L8-13 L15-18 L12 5 L7 0 L0 3 L-7 0Z',d.cloth);shape('M-5-12 L5-12 L4-2 L-4-2Z','#283440',null);}
    if(f.has('gem'))ellipse(0,-5,8,7,d.trim);
    if(f.has('brain')){ellipse(0,-6,9,7,'#d6a5ae');stroke([[-5,-8],[0,-3],[4,-8]],'#986b86',1);}
    if(f.has('turban')||f.has('cap')){shape('M-14 1 Q-17-15 0-17 Q16-15 14 1 L9 4 L-9 4Z',f.has('turban')?'#efefde':d.cloth);stroke([[-12,-4],[11,0]],f.has('turban')?'#c1c8b9':d.trim,2);stroke([[-10,-9],[9,-5]],'#ffffff70',1.4);}
    if(f.has('band'))stroke([[-12,2],[0,0],[12,2]],d.trim,2.5);
    if(f.has('horns'))for(const s of [-1,1])shape(`M${s*9}-3 Q${s*22}-12 ${s*16}-18 Q${s*16}-8 ${s*11} 2Z`,'#e9dcb6');
    if(f.has('antenna')||f.has('namek')){const ss=f.has('namek')?[-1,1]:[0];for(const s of ss){c.beginPath();c.moveTo(s*6,-8);c.quadraticCurveTo(s*12+3,-22,s*9+3,-20);c.strokeStyle=ink;c.lineWidth=4;c.stroke();c.strokeStyle=d.skin;c.lineWidth=2;c.stroke();}}
    if(f.has('spines'))for(const s of [-1,1])shape(`M${s*9}-8 L${s*15}-14 L${s*13}-4Z`,d.trim);
    // Face features remain inside the face; no marks are placed on the crown.
    for(const s of [-1,1]){shape(`M${s*2} 8 L${s*9} 6 L${s*8} 10 L${s*3} 10Z`,'#f4eee2',ink,.7);stroke([[s*5,8],[s*5,9.5]],form?'#278fa3':'#20252d',1.3);}
    c.beginPath();c.moveTo(-2,12);c.quadraticCurveTo(0,13.7,2,12);c.strokeStyle=shade(d.skin,-65);c.lineWidth=1;c.stroke();
    if(f.has('thirdEye'))ellipse(0,5,1.5,1.1,'#fff4de',ink,.6);
    if(f.has('fourEyes'))for(const s of [-1,1])ellipse(s*5.5,4,1.6,1.6,'#26303c',null);
    if(f.has('cheeks'))for(const s of [-1,1])ellipse(s*9,11,2,1.5,'#dd6b79',null);
    if(f.has('dots'))for(const [x,y] of [[-3,1],[0,0],[3,1],[-3,4],[0,3],[3,4]])ellipse(x,y,.65,.65,shade(d.skin,-55),null);
    if(f.has('glasses'))for(const s of [-1,1])ellipse(s*5.5,9,4,2.8,'#294559','#c6d5cd',1);
    if(f.has('scouter')||f.has('eyepatch')){shape('M2 5 L12 4 L12 11 L3 12Z',f.has('scouter')?'#58d598bb':'#263241','#d5e2cf',1);}
    if(f.has('scar'))stroke([[-9,8],[-7,12]],'#a36860',1);
    if(f.has('beard'))shape('M-9 12 L-5 20 L0 23 L5 20 L9 12 L0 15Z','#eae4d5');
    if(f.has('moustache'))shape('M0 11 Q-5 8-8 13 L-2 14 L0 12 L2 14 L8 13 Q5 8 0 11Z',hair||'#e8e0ce',null);
    if(f.has('snout'))ellipse(0,12,5,3,shade(d.skin,10));
    if(f.has('mask'))shape('M-10 10 L10 10 Q8 17 0 17 Q-8 17-10 10Z','#e5e9eb');
    if(f.has('earrings'))for(const s of [-1,1])ellipse(s*14,8,1.3,2,'#f4d47b',null);
    // At ninety degrees the crown occludes the face. Lean exposes only a
    // narrow brow; airborne/striking poses progressively reveal the profile.
    if(tilt<.72){
      c.save();c.globalAlpha*=1-ease(Math.max(0,Math.min(1,(tilt-.22)/.5)));
      const crown=f.has('turban')?'#efefde':f.has('cap')?d.cloth:hair||d.skin;
      const edge=16-tilt*15;
      shape(`M-12-9 Q0-17 12-9 L13 ${edge-5} L8 ${edge} L0 ${edge+1} L-8 ${edge} L-13 ${edge-5}Z`,crown,null);
      shape(`M-10-7 Q-4-12 0-10 L-5 ${edge-4} L-10 ${edge-6}Z`,shade(crown,18),null);
      if(hair)stroke([[3,-7],[5,0],[3,edge-2]],shade(hair,12),1.1);
      if(f.has('gem'))ellipse(0,1,7,8,d.trim);
      if(f.has('turban'))stroke([[-11,2],[10,6]],'#bcc5b6',1.5);
      c.restore();
    }
    c.restore();
    }
    for(const [h,s] of hands){
      const glove=d.rig==='armor'?'#efeddf':d.skin;
      c.save();c.translate(h[0],h[1]);c.rotate(hit&&s===strikeSide?-twist:0);
      shape('M-3-3 L2-4 L4-1 L3 4 L-2 4 L-4 1Z',glove,ink,1.25);
      stroke([[-1,1],[2,1]],shade(glove,-35),.7);stroke([[-2,-2],[1,-2]],shade(glove,20),1);
      c.restore();
    }
    if(hit&&!reduced&&cycle>.30&&cycle<.53){
      c.save();c.globalAlpha=(.53-cycle)/.23*.65;
      stroke([[strikeSide*20,8],[strikeSide*18,21],[strikeSide*7,35]],'#e6f5ff',1.3);
      stroke([[strikeSide*24,10],[strikeSide*21,23]],'#8edafa',.7);
      c.restore();
    }
    if(f.has('halo')){c.save();c.scale(1,.4);c.beginPath();c.ellipse(0,26,20,12,0,0,Math.PI*2);c.strokeStyle='#9ce6f0';c.lineWidth=1.5;c.stroke();c.restore();}
    if(charge||blast){const ki=e.equipped==='galick'?'#caa0ff':'#9aedff';if(state==='chargeAim'||blast){c.save();c.globalCompositeOperation='lighter';c.shadowColor=ki;c.shadowBlur=10;ellipse(0,29,blast?6:3+(e.chargeRatio||0)*3,blast?6:3,ki,null);ellipse(-1,30,2,2,'#ffffff',null);c.restore();}}
    c.restore();
  }
  Art.fighter=fighter;
})();

