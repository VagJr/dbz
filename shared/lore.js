(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.UZLore=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const sites=[
 {id:'kame',world:'earth',x:3200,y:4200,name:'Kame House',master:'Mestre Kame',reward:'kame',level:2,description:'Treino da Escola da Tartaruga: complete 5 acertos em 8 para aprender o Kamehameha.'},
 {id:'karin',world:'earth',x:-12000,y:-6200,name:'Torre Karin',master:'Karin',requires:'kame',level:3,description:'Refine seu tempo de reação. Cinco acertos concedem um ponto de atributo e 180 XP.'},
 {id:'lookout',world:'earth',x:-12000,y:-6800,name:'Templo de Kami',master:'Kami',requires:'karin',level:4,description:'Acima da Torre Karin: treine concentração e conquiste dois pontos de atributo.'},
 {id:'kaio',world:'otherworld',x:16000,y:1740,name:'Planeta do Senhor Kaio',master:'Senhor Kaio',reward:'genki',level:4,description:'Percorra o Caminho da Serpente, alcance Bubbles e domine o ritmo da gravidade para aprender Kaioken e Genki Dama.'},
 {id:'yardrat',world:'yardrat',x:3400,y:2300,name:'Santuário de Yardrat',master:'Mestre de Yardrat',reward:'teleport',level:6,requires:'kaio',description:'Após o treino de Kaio, pratique controle espiritual para aprender Transmissão Instantânea.'},
 {id:'whis',world:'divine',x:3400,y:2300,name:'Templo de treinamento de Whis',master:'Whis',reward:'divine',level:12,requires:'yardrat',description:'Refine seu ki em cinco acertos precisos para desbloquear Ki Divino.'}
 ];
 const snake=Array.from({length:25},(_,i)=>({x:1700+i*560,y:1740+Math.sin(i*Math.PI/3)*620}));
 function objective(p){const done=p.lore?.done||[],s=sites.find(s=>s.world===p.world&&!done.includes(s.id))||sites.find(s=>!done.includes(s.id));if(!s)return null;
 let point=s,text=s.description;
 if(s.id==='kaio'&&(p.lore?.snake||0)<snake.length){point=snake[p.lore?.snake||0];text=`Caminho da Serpente · marco ${(p.lore?.snake||0)+1}/${snake.length}. Siga o caminho em ordem.`;}
 else if(s.id==='kaio'&&!p.lore?.bubbles){point={x:s.x+Math.cos((p.serverTime||0)*.8)*150,y:s.y+Math.sin((p.serverTime||0)*.8)*110};text='Alcance Bubbles e pressione Interagir (E).';}
 return {...s,targetX:point.x,targetY:point.y,text};}
 return {sites,snake,objective};
});
