(function (root, factory) {
  const data = factory();
  if (typeof module === "object") module.exports = data;
  else root.UZSandbox = data;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const items = {
    ore: { name: "Minério estelar", art: 45 },
    crystal: { name: "Cristal de ki", art: 8 },
    herb: { name: "Erva medicinal", art: 43 },
    alloy: { name: "Liga de cápsula", art: 44 },
    medicine: { name: "Cápsula medicinal", art: 43 },
    battery: { name: "Célula de ki", art: 22 },
    camp: { name: "Cápsula de abrigo", art: 44 },
    workbench: { name: "Oficina portátil", art: 44 },
    gravity: { name: "Câmara gravitacional", art: 45 },
    garden: { name: "Viveiro medicinal", art: 43 },
    beacon: { name: "Farol de exploração", art: 46 },
  };
  const recipes = [
    { id: "alloy", cost: { ore: 3, crystal: 1 }, station: false, skill: 0 },
    { id: "medicine", cost: { herb: 3 }, station: false, skill: 0 },
    { id: "battery", cost: { crystal: 3 }, station: false, skill: 0 },
    { id: "camp", cost: { ore: 5, herb: 2 }, station: false, skill: 0 },
    { id: "workbench", cost: { alloy: 2, ore: 4 }, station: false, skill: 0 },
    { id: "garden", cost: { alloy: 1, herb: 6 }, station: true, skill: 1 },
    { id: "gravity", cost: { alloy: 4, crystal: 8 }, station: true, skill: 2 },
    { id: "beacon", cost: { alloy: 3, battery: 2 }, station: true, skill: 2 },
  ];
  const structures = {
    camp: { name: "Abrigo", action: "Descansar", seconds: 5 },
    workbench: { name: "Oficina", action: "Inspecionar oficina", seconds: 1 },
    gravity: {
      name: "Câmara de gravidade",
      action: "Treinar a 10×",
      seconds: 8,
    },
    garden: { name: "Viveiro", action: "Colher ervas", seconds: 4 },
    beacon: { name: "Farol", action: "Cartografar região", seconds: 5 },
  };
  const slots={head:'Cabeça',body:'Tronco',legs:'Pernas',feet:'Pés',hands:'Mãos',waist:'Cintura',back:'Costas',weapon:'Arma',accessory:'Acessório',device:'Dispositivo'};
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
  const paths = {
    explorer: {
      name: "Explorador",
      text: "Coleta rende uma unidade adicional. Descobertas alimentam seu legado.",
    },
    artisan: {
      name: "Inventor",
      text: "Fabricação concede o dobro de prática de ofício.",
    },
    guardian: {
      name: "Guardião",
      text: "Contribuições planetárias concedem o dobro de reputação.",
    },
  };
  const level = (x) => Math.min(20, Math.floor(Math.sqrt(Math.max(0, x) / 20)));
  function nodes(world, x, y) {
    if (world === "space") return [];
    const out = [];
    const cx = Math.floor(x / 600),
      cy = Math.floor(y / 600);
    for (let row = cy - 1; row <= cy + 1; row++)
      for (let col = cx - 1; col <= cx + 1; col++)
        for (let k = 0; k < 3; k++) {
          const kind = ["ore", "crystal", "herb"][k];
          out.push({
            id: `${world}:${col}:${row}:${kind}`,
            world,
            x: col * 600 + 120 + k * 165,
            y:
              row * 600 +
              140 +
              ((((col * 37 + row * 53 + k * 137) % 310) + 310) % 310),
            kind,
            name: items[kind].name,
          });
        }
    return out;
  }
  const contracts = [
    {
      id: "supply",
      name: "Suprimentos do assentamento",
      cost: { herb: 6 },
      zenni: 45,
      xp: 25,
    },
    {
      id: "industry",
      name: "Reconstrução da infraestrutura",
      cost: { alloy: 3 },
      zenni: 110,
      xp: 60,
    },
    {
      id: "energy",
      name: "Reserva de energia",
      cost: { battery: 3 },
      zenni: 90,
      xp: 50,
    },
  ];
  return {
    slots,
    items,
    recipes,
    structures,
    paths,
    level,
    nodes,
    contracts,
    capacity: 120,
  };
});
