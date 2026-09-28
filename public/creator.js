'use strict';
(()=>{const A=UZAvatar,C=UZSandbox,$=id=>document.getElementById(id);
let origin='saiyan',appearance=A.clean(),path='explorer',background='wanderer',viewAngle=-Math.PI/2,poseIndex=0;
const poses=[
  {label:'Parado',state:'idle',mode:'ground'},
  {label:'Andar',state:'run',mode:'ground'},
  {label:'Voar',state:'fly',mode:'flight'},
  {label:'Defesa',state:'guard',mode:'ground'},
  {label:'Soco',state:'attack',mode:'ground',motion:'jab'},
  {label:'Combo',state:'attack',mode:'ground',motion:'roundhouse'},
  {label:'Disparo',state:'blast',mode:'flight'},
  {label:'Dash',state:'dash',mode:'flight',motion:'lunge'},
];
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
const dialog=el('dialog','creator-dialog');dialog.id='creator-dialog';dialog.setAttribute('aria-labelledby','creator-title');
const head=el('header'),title=el('h2',null,'Uma origem. Um personagem seu.');title.id='creator-title';
const close=el('button',null,'Concluir');close.type='button';close.onclick=()=>{dialog.close();summary();};
head.append(title,close);
const layout=el('div','creator-layout'),stage=el('div','creator-stage'),canvas=el('canvas');
canvas.width=360;canvas.height=420;canvas.setAttribute('aria-label','Prévia do mesmo boneco do jogo nas poses escolhidas');
const race=el('strong'),note=el('p',null,'O próprio boneco do jogo, com as cores escolhidas. Selecione uma pose.');
const lineage=new Image();lineage.className='creator-lineage';lineage.alt='Retrato ilustrado da origem';
const poseStrip=el('div','creator-pose-strip');poseStrip.setAttribute('aria-label','Poses do personagem');
for(const [i,pose] of poses.entries()){
  const b=el('button',null,pose.label);b.type='button';b.setAttribute('aria-pressed',String(i===poseIndex));
  b.onclick=()=>{poseIndex=i;for(const [j,button] of [...poseStrip.children].entries())button.setAttribute('aria-pressed',String(j===i));};
  poseStrip.append(b);
}
const turnModel=el('button','creator-turn','↻ Girar boneco');turnModel.type='button';
turnModel.setAttribute('aria-label','Girar boneco do jogo');turnModel.onclick=()=>{viewAngle-=Math.PI/2;};
stage.append(lineage,canvas,race,note,poseStrip,turnModel);
const controls=el('div','creator-controls');layout.append(stage,controls);dialog.append(head,layout);document.body.append(dialog);
const choose=(label,values,current,set,paint)=>{const section=el('section'),h=el('h3',null,label),options=el('div','creator-options');section.append(h,options);values.forEach((v,i)=>{const b=el('button','creator-option');b.type='button';b.setAttribute('aria-pressed',String(current===v));paint(b,v,i);b.onclick=()=>{set(v);render();};options.append(b);});controls.append(section);};
function render(){lineage.src=UZPortrait.origin(origin);controls.replaceChildren();race.textContent=UZ.ORIGINS.find(o=>o.id===origin).name;choose('Silhueta',A.bodies,appearance.body,v=>appearance.body=v,(b,v)=>b.textContent=({slim:'Ágil',balanced:'Equilibrada',broad:'Robusta'})[v]);if(!['namekian','majin'].includes(origin))choose('Cabelo',A.cuts,appearance.cut,v=>appearance.cut=v,(b,v)=>{const cv=el('canvas');cv.width=78;cv.height=86;const c=cv.getContext('2d');Art.fighter(c,{skin:UZ.ORIGINS.find(o=>o.id===origin).skin,appearance:{...appearance,cut:v},x:39,y:43,angle:-Math.PI/2,previewFacing:true,state:'idle'},0,2.1);b.append(cv,el('span',null,({spike:'Espetado',part:'Repartido',bob:'Curto',pony:'Rabo',bun:'Coque',braid:'Trança'})[v]));});for(const [key,label]of Object.entries({skin:'Tom de pele',hair:'Cor do cabelo',cloth:'Roupa',trim:'Acabamento'})){if(key==='hair'&&['namekian','majin'].includes(origin))continue;choose(label,A.palettes[key].map((_,i)=>i),appearance[key],v=>appearance[key]=v,(b,v)=>{b.classList.add('color-swatch');b.style.setProperty('--swatch',A.palettes[key][v]);b.setAttribute('aria-label',label+' '+(v+1));});}
choose('Caminho inicial',Object.keys(C.paths),path,v=>path=v,(b,v)=>{const im=new Image();im.src='/assets/world-kit/items/'+({explorer:'010',artisan:'007',guardian:'004'})[v]+'.png';b.append(im,el('strong',null,C.paths[v].name),el('small',null,C.paths[v].text));b.classList.add('origin-life');});choose('Sua história antes de chegar',Object.keys(A.backgrounds),background,v=>background=v,(b,v)=>{b.append(el('strong',null,A.backgrounds[v].name),el('small',null,A.backgrounds[v].text));b.classList.add('origin-life');});}
const trigger=el('button','customize-trigger');trigger.id='customize-character';trigger.type='button';trigger.onclick=()=>{render();dialog.showModal();};const label=$('player-name').previousElementSibling;label.before(trigger);function summary(){trigger.replaceChildren(el('span',null,'✦ PERSONALIZAR PERSONAGEM'),el('small',null,C.paths[path].name+' · '+A.backgrounds[background].name+' →'));}summary();window.UZCreator={value:()=>({appearance:{...appearance},path,background}),origin:v=>{origin=v;if(dialog.open)render();}};
function frame(t){
  if(dialog.open){
    const c=canvas.getContext('2d');c.clearRect(0,0,360,420);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,clock=reduced?0:t/1000;
    const g=c.createRadialGradient(180,240,10,180,240,170);
    g.addColorStop(0,'#63e0e934');g.addColorStop(1,'#63e0e900');c.fillStyle=g;c.fillRect(0,0,360,420);
    c.strokeStyle='#f2d29677';c.beginPath();c.ellipse(180,365,110,27,0,0,Math.PI*2);c.stroke();
    const pose=poses[poseIndex],cycle=clock%1.25;
    const combatAction=pose.motion?{motion:{pose:pose.motion,side:1},start:0,impact:.25,activeEnd:.72,end:1.2}:null;
    Art.fighter(c,{skin:UZ.ORIGINS.find(o=>o.id===origin).skin,appearance,x:180,y:202,
      angle:viewAngle,previewFacing:Math.cos(viewAngle+Math.PI/2)>.9,state:pose.state,mode:pose.mode,combatAction,combatClock:cycle,
      previewPose:pose.motion,
      combo:pose.label==='Combo'?3:1,boosting:pose.label==='Dash'},clock,5.4);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
