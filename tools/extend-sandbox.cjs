const fs=require('fs');let p='shared/sandbox.js',s=fs.readFileSync(p,'utf8');const at=s.indexOf('  const paths =');const code=`  const slots={head:'Cabeça',body:'Tronco',legs:'Pernas',feet:'Pés',hands:'Mãos',waist:'Cintura',back:'Costas',weapon:'Arma',accessory:'Acessório',device:'Dispositivo'};
  const equipmentRows=['Elmo','Traje marcial','Armadura','Calça marcial','Botas','Luvas','Cinto','Manto','Arma','Dispositivo','Adorno','Escudo','Armadura cósmica','Kit de viagem'];
  const slotRows=['head','body','body','legs','feet','hands','waist','back','weapon','device','accessory','accessory','body','device'];
  const furnitureRows=['Assento','Mesa','Repouso','Armário','Luminária','Cozinha','Máquina','Jardim','Feira','Via pública','Habitação','Tecnologia','Dojo','Decoração'];
  const itemArt={ore:0,crystal:1,herb:2,alloy:3,medicine:4,battery:5,camp:6,workbench:7,gravity:8,garden:9,beacon:10};
  for(const [key,index] of Object.entries(itemArt))items[key].sprite={sheet:'items',index};
  for(let i=0;i<196;i++){
    const row=Math.floor(i/14), variant=String(i%14+1).padStart(2,'0'),key='gear_'+String(i).padStart(3,'0');
    const slot=slotRows[row],stat=['weapon','hands'].includes(slot)?'force':['head','device','accessory'].includes(slot)?'spirit':'vitality';
    items[key]={name:equipmentRows[row]+' · '+variant,sprite:{sheet:'equipment',index:i},slot,stat,bonus:1,category:'equipment'};
    recipes.push({id:key,cost:{alloy:1,ore:3},station:true,skill:1});
    const decor='decor_'+String(i).padStart(3,'0');
    items[decor]={name:furnitureRows[row]+' · '+variant,sprite:{sheet:'furniture',index:i},category:'furniture'};
    structures[decor]={name:items[decor].name,action:'Examinar',seconds:1,decor:true};
    recipes.push({id:decor,cost:{ore:2,alloy:1},station:true,skill:1});
  }
`;
s=s.slice(0,at)+code+s.slice(at);s=s.replace('return {','return {',1);s=s.replace('    items,','    slots,\n    items,');fs.writeFileSync(p,s);
p='src/sandbox.js';s=fs.readFileSync(p,'utf8').replace('const { randomUUID }','const Avatar = require("../shared/avatar");\nconst { randomUUID }');s=s.replace('    inventory,','    equipment: Object.fromEntries(Object.keys(C.slots).map(slot=>[slot, C.items[saved.equipment?.[slot]]?.slot===slot?saved.equipment[slot]:null])),\n    inventory,');s=s.replace('    p.sandbox = clean(data.sandbox);',`    p.sandbox = clean(data.sandbox);
    p.appearance = Avatar.clean(data.appearance || data.creation?.appearance);
    p.background = Object.hasOwn(Avatar.backgrounds, data.background || data.creation?.background) ? data.background || data.creation.background : 'wanderer';
    if (!data.sandbox && data.creation) {
      Object.assign(p.sandbox.inventory, Avatar.backgrounds[p.background].items);
      p.sandbox.path = Object.hasOwn(C.paths,data.creation.path)?data.creation.path:'explorer';
      Object.assign(p.sandbox.equipment,{body:'gear_014',feet:'gear_056',hands:'gear_070'});
    }
    p.gearBonus={force:0,spirit:0,vitality:0};
    this.sandboxGear(p);`);
s=s.replace('  Engine.prototype.profile =',`  Engine.prototype.sandboxGear = function(p){
    const next={force:0,spirit:0,vitality:0};for(const key of Object.values(p.sandbox.equipment)){const item=C.items[key];if(item?.slot)next[item.stat]+=item.bonus;}
    const previous=p.gearBonus||{force:0,spirit:0,vitality:0};
    for(const stat of Object.keys(next))p.stats[stat]+=next[stat]-previous[stat];
    p.maxHp+=(next.vitality-previous.vitality)*18;p.hp=Math.min(p.hp,p.maxHp);p.gearBonus=next;
  };
  Engine.prototype.profile =`);
s=s.replace('      citizenId: p.citizenId,','      citizenId: p.citizenId,\n      appearance: p.appearance,\n      background: p.background,\n      stats: Object.fromEntries(Object.entries(p.stats).map(([key,value])=>[key,value-(p.gearBonus?.[key]||0)])),');
s=s.replace('    if (data.action === "path") {',`    if (data.action === 'wear') {
      const item=C.items[data.item];if(!item?.slot||!s.inventory[data.item])return fail('Equipamento indisponível.');
      const old=s.equipment[item.slot];if(!this.sandboxPay(p,{[data.item]:1},old?{[old]:1}:{}))return fail('Sem espaço para a troca.');
      s.equipment[item.slot]=data.item;this.sandboxGear(p);return ok(item.name+' equipado.');
    }
    if(data.action==='unwear'){
      if(!Object.hasOwn(C.slots,data.slot))return fail('Slot inválido.');const item=s.equipment[data.slot];
      if(!item||!this.sandboxPay(p,{}, {[item]:1}))return fail('Mochila cheia ou slot vazio.');s.equipment[data.slot]=null;this.sandboxGear(p);return ok('Equipamento guardado.');
    }
    if (data.action === "path") {`);
s=s.replace('      if (b.kind === "workbench")','      if (C.structures[b.kind].decor) return ok(C.structures[b.kind].name + " · peça de decoração instalada por " + b.ownerName);\n      if (b.kind === "workbench")');
s=s.replace('    out.self.sandbox =', '    out.self.appearance=p.appearance;out.self.background=p.background;\n    for(const player of out.players){const actual=this.players.get(player.id);if(actual)player.appearance=actual.appearance;}\n    out.self.sandbox =');fs.writeFileSync(p,s);
p='server.js';s=fs.readFileSync(p,'utf8').replace('profile = { name: cleanName(data.name), origin: data.origin };','profile = { name: cleanName(data.name), origin: data.origin, creation: data.creation && typeof data.creation === "object" ? data.creation : undefined };');fs.writeFileSync(p,s);
p='public/app.js';s=fs.readFileSync(p,'utf8').replace('{ name: $("player-name").value.trim(), origin: selected }','{ name: $("player-name").value.trim(), origin: selected, creation: window.UZCreator?.value() }').replace('window.UZUI?.origin(origin);','window.UZUI?.origin(origin);\n    window.UZCreator?.origin(origin);');fs.writeFileSync(p,s);
p='public/index.html';s=fs.readFileSync(p,'utf8').replace('<script src="/character-art.js">','<script src="/shared/avatar.js"></script>\n    <script src="/character-art.js">').replace('<script src="/app.js">','<script src="/creator.js"></script>\n    <script src="/world-kit.js"></script>\n    <script src="/app.js">').replace('<link rel="stylesheet" href="/sandbox-ui.css"', '<link rel="stylesheet" href="/creator.css" />\n    <link rel="stylesheet" href="/sandbox-ui.css"');fs.writeFileSync(p,s);
p='public/character-art.js';s=fs.readFileSync(p,'utf8');const helper=`  function personalDesign(base,e){
    if(!e.appearance||typeof UZAvatar==='undefined')return base;const a=UZAvatar.clean(e.appearance),p=UZAvatar.palettes;
    const flags=base.flags.filter(f=>!['slim','wide','large','small'].includes(f));if(a.body==='slim')flags.push('slim');if(a.body==='broad')flags.push('wide');
    return {...base,flags,skin:p.skin[a.skin],hair:base.hair?p.hair[a.hair]:base.hair,cut:a.cut,cloth:p.cloth[a.cloth],trim:p.trim[a.trim]};
  }
`;
s=s.replace('  function fighter(',helper+'  function fighter(').replace('d = UZDesigns[e.skin] || UZDesigns[meta?.skin] || UZDesigns.soldier;','d = personalDesign(UZDesigns[e.skin] || UZDesigns[meta?.skin] || UZDesigns.soldier,e);').replace('const d = UZDesigns[e.skin] || UZDesigns.goku,','const d = personalDesign(UZDesigns[e.skin] || UZDesigns.goku,e),');fs.writeFileSync(p,s);
