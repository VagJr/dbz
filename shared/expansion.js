(function(root,factory){
  if(typeof module==="object"&&module.exports)module.exports=factory(require("./content"));
  else root.UZExpansion=factory(root.UZ);
})(typeof globalThis!=="undefined"?globalThis:this,function(UZ){
"use strict";
const landmarks=[
  ["capsule-corp","earth",10200,3400,"Capsule Corporation","city","Cúpulas, oficinas e rotas de viagem."],
  ["penguin-village","earth",4300,4600,"Vila Pinguim","village","Uma pequena comunidade além da ilha de Kame."],
  ["muscle-tower","earth",7900,-10800,"Torre Músculo","base","Fortaleza da Red Ribbon nas terras frias."],
  ["sacred-water","earth",-12000,-6200,"Torre Karin","sanctuary","Um desafio de escalada e disciplina."],
  ["cell-arena","earth",16200,15400,"Arena dos Cell Games","arena","Um campo aberto para confrontos de alto nível."],
  ["namek-tsuno","namek",4800,3900,"Vila de Tsuno","village","Casas namekuseijins entre água e ajisas."],
  ["namek-moori","namek",-6100,5900,"Vila de Moori","village","Uma aldeia que precisa ser protegida."],
  ["namek-elder","namek",7600,-5100,"Casa do Patriarca","sanctuary","Refúgio elevado do Grande Patriarca."],
  ["namek-ship","namek",-10400,2600,"Nave de Freeza","base","Centro de operações da força invasora."],
  ["vegeta-garrison","vegeta",8400,3600,"Guarnição Saiyajin","base","Treino de combate e leitura de poder."],
  ["future-lab","future",6400,3000,"Laboratório do Futuro","city","Vestígios da resistência contra os androides."],
  ["yardrat-sanctuary","yardrat",3400,2300,"Santuário de Yardrat","sanctuary","Controle espiritual e deslocamento."],
  ["demon-gate","demon",6400,-3400,"Portão do Reino Demoníaco","secret","Uma fenda que atrai criaturas agressivas."],
  ["divine-training","divine",3400,2300,"Campo de Whis","sanctuary","Espaço de treino de ki refinado."],
  ["otherworld-kaio","otherworld",16000,1740,"Planeta do Senhor Kaio","sanctuary","Gravidade e treino depois do Caminho da Serpente."],
  ["vampa-cave","vampa",5100,6400,"Caverna de Vampa","cave","Um refúgio em terreno hostil."],
  ["cereal-ruins","cereal",9200,-4300,"Ruínas de Cereal","secret","Memórias e suprimentos entre construções antigas."],
  ["arena-gate","arena",6500,3000,"Portão do Torneio","arena","Um ponto de encontro para duelos consentidos."]
].map(([id,world,x,y,name,kind,description])=>({id,world,x,y,name,kind,description}));
const landmarkById=Object.fromEntries(landmarks.map(x=>[x.id,x]));
const npcs=[
  ["bulma","capsule-corp","Bulma","bulma","engineer","Se a rota parece impossível, comece pelo radar e pelo combustível.",["paozu-supplies","west-delivery"]],
  ["chichi","penguin-village","Chi-Chi","chichi","guide","Cuide das pessoas do caminho; vencer uma luta não resolve tudo.",["paozu-supplies"]],
  ["rr-defector","muscle-tower","Desertor Red Ribbon","soldier","informant","A patrulha guarda os acessos da torre. Encontre uma abertura.",["ribbon-sabotage"]],
  ["dende","namek-moori","Dende","dende","healer","A aldeia pode resistir se chegarmos juntos ao abrigo.",["namek-escort","namek-ajisa"]],
  ["piccolo","namek-tsuno","Piccolo","piccolo","mentor","Controle a distância. O adversário mais forte ainda deixa aberturas.",["namek-ajisa"]],
  ["vegeta","vegeta-garrison","Vegeta","vegeta","mentor","Poder sem domínio é desperdício. Me mostre sua leitura de combate.",["vegeta-trial"]],
  ["trunks","future-lab","Trunks","trunks","guide","Os androides percorrem as ruínas. Ataque depois do disparo.",["future-raid"]],
  ["yardrat-master","yardrat-sanctuary","Mestre de Yardrat","yardrat","mentor","Movimente o corpo só depois de sentir o fluxo do ki.",["yardrat-focus"]],
  ["demon-scout","demon-gate","Explorador do portal","glorio","guide","A fenda reage à presença de guerreiros. Segure sua posição.",["demon-defense"]],
  ["whis","divine-training","Whis","whis","mentor","A precisão no momento certo vale mais que um ataque apressado.",["divine-discipline"]],
  ["kai","otherworld-kaio","Senhor Kaio","kai","mentor","Seu próximo salto vem do ritmo, não de força bruta.",["kaio-endurance"]],
  ["frontier-scout","cereal-ruins","Explorador estelar","granolah","guide","Além das rotas conhecidas, cada setor guarda uma surpresa.",["frontier-hunt"]]
].map(([id,landmark,name,skin,role,dialogue,quests])=>({id,landmark,name,skin,role,dialogue,quests}));
const sideQuests=[
  {id:"paozu-supplies",title:"Cápsulas para Paozu",giver:"chichi",world:"earth",level:1,kind:"collect",target:"paozu-cache",count:3,rewards:{xp:95,zenni:65,item:"senzu"}},
  {id:"west-delivery",title:"Entrega da Cidade do Oeste",giver:"bulma",world:"earth",level:2,kind:"visit",target:"capsule-corp",rewards:{xp:110,zenni:90,item:"capsule"}},
  {id:"ribbon-sabotage",title:"Interromper a Red Ribbon",giver:"rr-defector",world:"earth",level:4,kind:"hunt",family:"ribbon",count:5,target:"muscle-tower",rewards:{xp:180,zenni:150,item:"scouter"}},
  {id:"namek-escort",title:"Proteja Dende",giver:"dende",world:"namek",level:6,kind:"escort",target:"namek-elder",rewards:{xp:240,zenni:140,item:"senzu"}},
  {id:"namek-ajisa",title:"Bosques de ajisa",giver:"piccolo",world:"namek",level:6,kind:"visit",target:"namek-tsuno",rewards:{xp:160,zenni:90,item:"kiFocus"}},
  {id:"vegeta-trial",title:"Prova Saiyajin",giver:"vegeta",world:"vegeta",level:7,kind:"hunt",family:"saiyan",count:5,target:"vegeta-garrison",rewards:{xp:300,zenni:210,item:"weightedGi"}},
  {id:"future-raid",title:"Ruínas sob ataque",giver:"trunks",world:"future",level:9,kind:"hunt",family:"android",count:6,target:"future-lab",rewards:{xp:390,zenni:260,item:"pulseGloves"}},
  {id:"yardrat-focus",title:"Ritmo espiritual",giver:"yardrat-master",world:"yardrat",level:6,kind:"train",count:5,target:"yardrat-sanctuary",rewards:{xp:210,zenni:100,item:"kiFocus"}},
  {id:"demon-defense",title:"Segure o portal",giver:"demon-scout",world:"demon",level:10,kind:"defend",seconds:25,target:"demon-gate",rewards:{xp:460,zenni:300,item:"senzu"}},
  {id:"divine-discipline",title:"Disciplina divina",giver:"whis",world:"divine",level:12,kind:"train",count:8,target:"divine-training",rewards:{xp:530,zenni:330,item:"kiFocus"}},
  {id:"kaio-endurance",title:"Gravidade do Senhor Kaio",giver:"kai",world:"otherworld",level:4,kind:"train",count:5,target:"otherworld-kaio",rewards:{xp:230,zenni:120,item:"weightedGi"}},
  {id:"frontier-hunt",title:"Caçada da fronteira",giver:"frontier-scout",world:"cereal",level:14,kind:"hunt",family:"frontier",count:8,target:"cereal-ruins",repeatable:true,rewards:{xp:650,zenni:410,item:"capsule"}}
];
const pickupSites=[
  {id:"paozu-cache-1",world:"earth",x:1780,y:1550,item:"paozu-cache"},
  {id:"paozu-cache-2",world:"earth",x:2210,y:1910,item:"paozu-cache"},
  {id:"paozu-cache-3",world:"earth",x:1250,y:2120,item:"paozu-cache"}
];
const enemyFamilies={
  earth:[
    {id:"wildlife",name:"Predador das montanhas",skin:"demon",min:1,region:"Montanhas Paozu"},
    {id:"ribbon",name:"Soldado Red Ribbon",skin:"soldier",min:4,region:"Território da Red Ribbon"},
    {id:"desert",name:"Mercenário do deserto",skin:"yamcha",min:6,region:"Deserto de Yamcha"},
    {id:"android",name:"Android errante",skin:"android",min:15,region:"Cidade do Oeste"}
  ],
  namek:[
    {id:"freeza",name:"Soldado de Freeza",skin:"soldier",min:6},
    {id:"namekian",name:"Guerreiro corrompido",skin:"piccolo",min:9},
    {id:"ginyu",name:"Vanguarda Ginyu",skin:"ginyu",min:12}
  ],
  vegeta:[{id:"saiyan",name:"Soldado Saiyajin",skin:"vegeta",min:7}],
  future:[{id:"android",name:"Androide de patrulha",skin:"android",min:9}],
  demon:[{id:"demon",name:"Criatura demoníaca",skin:"demon",min:10}],
  yardrat:[{id:"spirit",name:"Eco espiritual",skin:"yardrat",min:6}],
  divine:[{id:"divine",name:"Guardião de ki",skin:"whis",min:12}],
  cereal:[{id:"frontier",name:"Caçador da fronteira",skin:"granolah",min:14}]
};
const forms=[
  {id:"super-saiyan",origin:"saiyan",name:"Super Saiyajin",level:1,power:1.4,duration:15,kiDrain:0},
  {id:"super-saiyan-2",origin:"saiyan",name:"Super Saiyajin 2",level:10,power:1.65,duration:17,kiDrain:2},
  {id:"super-saiyan-3",origin:"saiyan",name:"Super Saiyajin 3",level:20,power:1.9,duration:13,kiDrain:5},
  {id:"saiyan-god",origin:"saiyan",name:"Ki divino saiyajin",level:30,power:2.05,duration:17,kiDrain:4,requires:"divine"},
  {id:"earth-potential",origin:"earthling",name:"Potencial liberado",level:1,power:1.4,duration:15,kiDrain:0},
  {id:"earth-mastery",origin:"earthling",name:"Mestre do ki",level:15,power:1.7,duration:19,kiDrain:2},
  {id:"namek-fusion",origin:"namekian",name:"Fusão namekuseijin",level:1,power:1.4,duration:15,kiDrain:0},
  {id:"namek-potential",origin:"namekian",name:"Potencial desperto",level:13,power:1.72,duration:19,kiDrain:2},
  {id:"majin-power",origin:"majin",name:"Poder Majin",level:1,power:1.4,duration:15,kiDrain:0},
  {id:"majin-ascend",origin:"majin",name:"Majin elevado",level:16,power:1.76,duration:18,kiDrain:3}
];
const items={
  senzu:{id:"senzu",name:"Semente dos Deuses",kind:"consumable",description:"Recupera HP e ki no combate.",max:20},
  capsule:{id:"capsule",name:"Cápsula de reparo",kind:"consumable",description:"Recupera uma parte do HP.",max:30},
  scouter:{id:"scouter",name:"Scouter",kind:"gear",description:"Aumenta o alcance da seleção de alvo."},
  weightedGi:{id:"weightedGi",name:"Roupa de treino",kind:"gear",description:"Treinos rendem mais poder."},
  kiFocus:{id:"kiFocus",name:"Foco de ki",kind:"gear",description:"Reduz o gasto dos disparos."},
  pulseGloves:{id:"pulseGloves",name:"Luvas de pulso",kind:"gear",description:"Fortalece golpes corpo a corpo."}
};
const worldEvents={
  earth:{id:"red-ribbon-raid",title:"Investida Red Ribbon",name:"Comandante Red Ribbon",skin:"generalBlue",level:8,style:"duelist"},
  namek:{id:"freeza-landing",title:"Nave de Freeza",name:"Oficial de Freeza",skin:"frieza",level:13,style:"artillery"},
  vegeta:{id:"saiyan-assault",title:"Ofensiva Saiyajin",name:"Elite Saiyajin",skin:"nappa",level:15,style:"juggernaut"},
  future:{id:"android-attack",title:"Ataque dos Androides",name:"Androide de elite",skin:"android",level:18,style:"skirmisher"},
  demon:{id:"demon-invasion",title:"Fenda Demoníaca",name:"Guardião demoníaco",skin:"dabura",level:22,style:"duelist"},
  default:{id:"galactic-raid",title:"Invasão Galáctica",name:"Invasor de elite",skin:"ginyu",level:16,style:"duelist"}
};
return {landmarks,landmarkById,npcs,sideQuests,pickupSites,enemyFamilies,forms,items,worldEvents};
});