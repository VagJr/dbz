(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.UZUniverseAtlas = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /*
   * Production atlas for the 19 world IDs already present in shared/content.js.
   * x/y and radius are GAMEPLAY units in a proposed expanded coordinate system.
   * They are not canonical distances, planetary diameters or a claim of 1:1 lore
   * geography. legacyAnchor records coordinates already used by expansion/lore.
   * A migration must move active quest/NPC positions together with each anchor.
   * "documented" applies to the named place, never to its invented x/y or size.
   */
  const VERSION = 1;
  const COORDINATE_SYSTEM = Object.freeze({
    unit: "gameplay-unit",
    origin: "Cada mundo possui origem local e superfície independente.",
    placement: "Os sítios se afastam por ritmo de MMO; orientação e medidas exatas não são canônicas.",
    targetWalkUnitsPerMinute: 850,
    cityRule: "Cidade: distritos separados por 1.500–5.000 unidades, serviços espalhados em ruas navegáveis.",
    wildernessRule: "Entre cidades e biomas: travessias de dezenas de milhares de unidades com abrigo e acontecimentos intermediários.",
  });

  const SOURCES = Object.freeze({
    gokuHome: { title: "Goku's Neighborhood", url: "https://en.dragon-ball-official.com/news/01_680.html", note: "Casa da família, córrego, vila do distrito 439 e distância até a escola." },
    frypan: { title: "Fry-pan Mountain", url: "https://en.dragon-ball-official.com/news/01_787.html", note: "Monte Frigideira, castelo e relação com a casa de Goku." },
    kame: { title: "Kame House Area", url: "https://en.dragon-ball-official.com/news/01_799.html", note: "Casa na ilha ao sul do continente central; moradores e partida para Namekusei." },
    karin: { title: "Karin Sanctuary & Kami's Palace", url: "https://en.dragon-ball-official.com/news/01_597.html", note: "Santuário, Torre Karin, Palácio de Kami e Sala do Espírito e do Tempo." },
    west: { title: "West City Area", url: "https://en.dragon-ball-official.com/news/01_551.html", note: "Cidade do Oeste, Capsule Corporation, laboratório e sala de gravidade." },
    central: { title: "Central City Area", url: "https://en.dragon-ball-official.com/news/01_203.html", note: "Cidade Central, castelo e localização relativa da Arena de Cell." },
    tournament: { title: "Tenkaichi Budokai Arena", url: "https://en.dragon-ball-official.com/news/01_833.html", note: "Ilha Papaya e edifícios do complexo do torneio." },
    ribbon: { title: "Red Ribbon Army Headquarters Area", url: "https://en.dragon-ball-official.com/news/01_646.html", note: "Quartel, torres, alojamentos e relação com o Santuário Karin." },
    muscle: { title: "Muscle Tower Area", url: "https://en.dragon-ball-official.com/news/01_386.html", note: "Torre Músculo sobre a Vila Jingle e sua estrutura de andares." },
    pilaf: { title: "Pilaf's Castle", url: "https://en.dragon-ball-official.com/news/01_707.html", note: "Castelo de Pilaf, esconderijo de Yamcha e Monte Frigideira." },
    baba: { title: "Uranai Baba's Palace", url: "https://en.dragon-ball-official.com/news/01_750.html", note: "Palácio no lago do deserto, arenas e aldeia de Namu." },
    yunzabit: { title: "Yunzabit Highlands Area", url: "https://en.dragon-ball-official.com/news/01_182.html", note: "Nave do antigo Kami e arredores do extremo noroeste." },
    namek: { title: "Namek Editorial", url: "https://en.dragon-ball-official.com/news/01_530.html", note: "Aldeias de Tsuno/Muri, Dende, Grande Patriarca e vida namekuseijin." },
    namekEcology: { title: "Planet Namek Ecosystem", url: "https://en.dragon-ball-official.com/news/01_1917.html", note: "Árvores alienígenas, água verde e paisagem de Namekusei." },
    story: { title: "The Story of Dragon Ball in 42 Panels — Part Two", url: "https://en.dragon-ball-official.com/news/01_3864.html", note: "Viagem a Namekusei, Força Ginyu e batalha contra Freeza." },
    snake: { title: "Ogre Guide", url: "https://en.dragon-ball-official.com/news/01_3336.html", note: "Tribunal de Enma, acesso ao Caminho da Serpente e planeta do Senhor Kaioh." },
    kai: { title: "Yamcha from the Frieza Arc", url: "https://en.dragon-ball-official.com/news/01_2793.html", note: "Treino no planeta do Kaioh depois do Caminho da Serpente." },
    pybara: { title: "Pybara from Dragon Ball Super", url: "https://en.dragon-ball-official.com/news/01_2841.html", note: "Yardrat, controle espiritual e Transmissão Instantânea." },
    cereal: { title: "Granolah from Dragon Ball Super", url: "https://en.dragon-ball-official.com/news/01_4361.html", note: "Cereal, Granolah, Monaito e passado dos cerealjins." },
    sugar: { title: "The Sugarians from Dragon Ball Super", url: "https://en.dragon-ball-official.com/news/01_2827.html", note: "Cidade sob cúpula, aeroporto, lojas e moradia distante de Granolah." },
    sadala: { title: "Caulifla from Dragon Ball Super", url: "https://en.dragon-ball-official.com/news/01_1457.html", note: "Sadala do Universo 6, território de Caulifla e exército." },
    cabba: { title: "Cabba from Dragon Ball Super", url: "https://en.dragon-ball-official.com/news/01_271.html", note: "Patrulha saiyajin do Universo 6." },
    beerus: { title: "Whis from Battle of Gods", url: "https://en.dragon-ball-official.com/news/01_1663.html", note: "Planeta de Bills e treinamento com Whis." },
    supreme: { title: "East Supreme Kai", url: "https://en.dragon-ball-official.com/news/01_1908.html", note: "Reino dos Kaioshins e confronto final com Majin Buu." },
    babidi: { title: "Babidi's Hidden Spaceship", url: "https://en.dragon-ball-official.com/news/01_781.html", note: "Nave enterrada a sudoeste do continente central e seus vários andares." },
    broly: { title: "Broly from Dragon Ball Super: Broly", url: "https://en.dragon-ball-official.com/news/01_941.html", note: "Exílio em Vampa, Broly, Paragus e Ba." },
    kanassa: { title: "The Kanassans", url: "https://en.dragon-ball-official.com/news/01_4239.html", note: "Planeta Kanassa e invasão de Bardock no especial de TV." },
    konats: { title: "Tapion from Wrath of the Dragon", url: "https://en.dragon-ball-official.com/news/01_2603.html", note: "Konats, Tapion e selo de Hirudegarn no filme." },
    freeza79: { title: "Kiwi", url: "https://en.dragon-ball-official.com/news/01_4036.html", note: "Planeta Freeza n.º 79 e retorno de Vegeta." },
    daima: { title: "Dragon Ball DAIMA Demon Realm", url: "https://en.dragon-ball-official.com/news/01_2865.html", note: "Reino Demoníaco, Glorio, Panzy e Gomah." },
    future: { title: "Dragon Ball Super Story So Far", url: "https://en.dragon-ball-official.com/news/01_900.html", note: "Linha do tempo de Trunks, androides, Goku Black e Zamasu." },
    zeno: { title: "Marcarita from Dragon Ball Super", url: "https://en.dragon-ball-official.com/news/01_4094.html", note: "Palácio de Zen-Oh e Torneio do Poder." },
  });

  // `id` is exactly the identifier of UZ.WORLDS. Era access is a gameplay gate:
  // Vegeta, Tsufuru, Kanassa and Konats are not silently presented as present-day
  // intact worlds in the same chronology as current Earth.
  const WORLD_PLANS = [
    ["earth", 7, "mortal", "Terra", [-210000,-155000,195000,155000], "current"],
    ["namek", 7, "mortal", "Namekusei", [-95000,-80000,95000,90000], "historical-or-restored"],
    ["vegeta", 7, "mortal", "Planeta Vegeta", [-110000,-80000,110000,80000], "historical-instance"],
    ["future", 7, "timeline", "Futuro de Trunks", [-115000,-80000,105000,85000], "alternate-timeline"],
    ["otherworld", 7, "afterlife", "Outro Mundo", [-35000,-45000,115000,60000], "spiritual"],
    ["demon", 7, "demon-realm", "Reino Demoníaco", [-105000,-90000,100000,80000], "realm-instance"],
    ["vampa", 7, "mortal", "Vampa", [-65000,-60000,70000,65000], "current"],
    ["divine", 7, "divine", "Planeta de Bills", [-50000,-50000,50000,50000], "current"],
    ["arena", 0, "void", "Mundo do Vazio", [-40000,-40000,40000,40000], "event-instance"],
    ["yardrat", 7, "mortal", "Yardrat", [-85000,-75000,85000,80000], "current"],
    ["cereal", 7, "mortal", "Cereal", [-90000,-70000,95000,75000], "current"],
    ["sadala", 6, "mortal", "Sadala", [-120000,-90000,120000,95000], "current"],
    ["champa", 6, "divine", "Planeta de Champa", [-50000,-45000,50000,50000], "current"],
    ["tsufuru", 7, "historical", "Planeta Tsufuru", [-85000,-70000,85000,70000], "adapted-history"],
    ["kanassa", 7, "historical", "Kanassa", [-85000,-70000,85000,75000], "historical-instance"],
    ["konatsu", 7, "film", "Konats", [-85000,-75000,85000,75000], "film-instance"],
    ["sacred", 7, "divine", "Mundo dos Kaioshins", [-75000,-65000,75000,65000], "current"],
    ["zeno", 0, "divine", "Palácio de Zen-Oh", [-45000,-40000,45000,40000], "restricted"],
    ["frieza", 7, "mortal", "Planeta Freeza n.º 79", [-85000,-70000,85000,70000], "current"],
  ].map(([id, universe, realm, name, bounds, era]) => Object.freeze({id,universe,realm,name,bounds,era}));
  const WORLD_BY_ID = Object.freeze(Object.fromEntries(WORLD_PLANS.map(w => [w.id,w])));

  // Preserve old expansion.js anchors to migrate live quest/NPC references as a unit.
  const LEGACY = Object.freeze({
    "capsule-corp":[10200,3400],"penguin-village":[4300,4600],"muscle-tower":[7900,-10800],
    "sacred-water":[-12000,-6200],"cell-arena":[16200,15400],"namek-tsuno":[4800,3900],
    "namek-moori":[-6100,5900],"namek-elder":[7600,-5100],"namek-ship":[-10400,2600],
    "vegeta-garrison":[8400,3600],"future-lab":[6400,3000],"yardrat-sanctuary":[3400,2300],
    "demon-gate":[6400,-3400],"divine-training":[3400,2300],"otherworld-kaio":[16000,1740],
    "vampa-cave":[5100,6400],"cereal-ruins":[9200,-4300],"arena-gate":[6500,3000],
    "kame":[3200,4200],"karin":[-12000,-6200],"lookout":[-12000,-6800],"kaio":[16000,1740],
    "yardrat":[3400,2300],"whis":[3400,2300],"snake-entry":[1700,1740],
  });

  const SITES = [];
  function add(world, region, sourceIds, rows) {
    if (!WORLD_BY_ID[world]) throw new Error("Unknown atlas world: " + world);
    for (const row of rows) {
      const [id,name,kind,x,y,radius,level,details = {}] = row;
      SITES.push(Object.freeze({
        id,world,universe:WORLD_BY_ID[world].universe,realm:WORLD_BY_ID[world].realm,
        region,name,kind,x,y,radius,level,
        loreStatus:details.loreStatus || "documented",
        placementStatus:"gameplay-adaptation", sourceIds:details.sourceIds || sourceIds,
        era:details.era || WORLD_BY_ID[world].era,
        access:details.access || "surface",
        npcIds:details.npcIds || [], resources:details.resources || [],
        hooks:details.hooks || [], production:details.production || "landmark",
        legacyAnchor:LEGACY[id] ? {x:LEGACY[id][0],y:LEGACY[id][1]} : null,
      }));
    }
  }

  // Terra: cada cidade é uma região percorrível, com bairros e serviços afastados.
  add("earth","Monte Paozu",["gokuHome"],[
    ["paozu-trail","Trilha de chegada ao Monte Paozu","route",1700,1740,1400,1,{loreStatus:"adaptation",resources:["herb","wood","fish"],hooks:["first-journey"],production:"starter"}],
    ["grandpa-gohan-house","Casa do Vovô Gohan","home",9800,-7200,850,1,{npcIds:["goku"],resources:["fish","wood"],hooks:["family-memory"]}],
    ["paozu-wilderness","Bosque e encostas de Paozu","wilderness",12500,-12000,9000,1,{loreStatus:"adaptation",resources:["herb","wood","ore","wild-food"],hooks:["wildlife-cycle","training"]}],
    ["frypan-mountain","Monte Frigideira","mountain",27500,6000,5000,4,{npcIds:["oxking","chichi"],resources:["ore","herb"],hooks:["castle-rebuilding"],sourceIds:["frypan"]}],
  ]);
  add("earth","Distrito 439",["gokuHome"],[
    ["goku-family-house","Casa de Goku e Chi-Chi","home",72500,-24500,900,5,{npcIds:["goku","chichi","gohan","goten"],resources:["fish","vegetables"],hooks:["family-routine","sparring"]}],
    ["east-439-village","Vila do distrito 439","village",65500,-22000,2700,4,{loreStatus:"adaptation",resources:["food","wood"],hooks:["community-trade"]}],
    ["gohan-training-hills","Colinas de treino de Gohan","training",79000,-27000,7000,6,{npcIds:["gohan","goten"],resources:["ore","herb"],hooks:["friendly-sparring"]}],
  ]);
  add("earth","Cidade do Oeste",["west"],[
    ["west-city","Cidade do Oeste","city",-100000,13500,11500,7,{npcIds:["bulma","vegeta","trunks"],resources:["market-goods"],hooks:["city-commerce","public-transit"],production:"city"}],
    ["west-station","Estação Oeste","transit",-106000,11800,1400,7,{loreStatus:"adaptation",hooks:["transit","courier"]}],
    ["west-market","Mercado Oeste","market",-103500,17800,2400,7,{loreStatus:"adaptation",resources:["food","capsule-parts"],hooks:["player-stalls","contracts"]}],
    ["capsule-corp","Capsule Corporation","laboratory",-96500,8500,2500,7,{npcIds:["bulma","vegeta","trunks"],resources:["capsule-parts","alloy"],hooks:["engineering","ship-building"],production:"hero-landmark"}],
    ["briefs-lab","Laboratório do Dr. Brief","laboratory",-92500,12200,1700,7,{npcIds:["bulma"],hooks:["technology-research"]}],
    ["gravity-room","Câmara de gravidade","training",-95000,6800,850,9,{npcIds:["vegeta"],hooks:["gravity-training"],access:"capsule-corp"}],
    ["west-residential","Bairros residenciais do Oeste","district",-100500,23500,3300,7,{loreStatus:"adaptation",hooks:["npc-housing","business-property"]}],
    ["west-hospital","Hospital da Cidade do Oeste","hospital",-109000,16000,1800,7,{hooks:["injury-care","healing-profession"]}],
  ]);
  add("earth","Cidade Central",["central"],[
    ["central-city","Cidade Central","city",-17000,13000,13000,9,{resources:["market-goods"],hooks:["governance","city-commerce"],production:"city"}],
    ["king-castle","Castelo do Rei","government",-18500,8300,2600,9,{hooks:["world-crisis","public-contracts"]}],
    ["central-market","Mercado Central","market",-23000,16500,3000,9,{loreStatus:"adaptation",hooks:["player-stalls","trade-route"]}],
    ["central-broadcast","Estação de TV Central","media",-9500,14000,1400,10,{hooks:["cell-games-broadcast","rankings"]}],
    ["cell-arena","Arena dos Cell Games","arena",-47500,-18000,2600,19,{npcIds:["cell"],hooks:["world-boss","seasonal-tournament"]}],
  ]);
  add("earth","Satan City",["gokuHome"],[
    ["satan-city","Satan City","city",104000,17000,10000,10,{loreStatus:"adaptation",resources:["market-goods"],hooks:["city-commerce"],production:"city"}],
    ["orange-star-school","Escola Orange Star","school",108000,13500,1900,10,{npcIds:["gohan","videl"],hooks:["school-schedule","reputation"]}],
    ["satan-city-market","Mercado de Satan City","market",100000,20500,2200,10,{loreStatus:"adaptation",hooks:["player-stalls"]}],
  ]);
  add("earth","Mar do Sul",["kame"],[
    ["south-coast-port","Porto da costa sul","port",-22500,80000,3200,3,{loreStatus:"adaptation",resources:["fish","ship-parts"],hooks:["ferry","sea-trade"]}],
    ["kame","Ilha da Kame House","island",-16500,101000,2600,3,{npcIds:["roshi","krillin","turtle","launch"],resources:["fish","herb"],hooks:["turtle-school","space-expedition"],production:"hero-landmark"}],
    ["kame-house-interior","Interior da Kame House","interior",-16250,101100,260,3,{npcIds:["roshi"],hooks:["mentorship","rest"],access:"kame"}],
    ["penguin-village","Vila Pinguim","village",-45000,107000,2800,3,{npcIds:["arale"],resources:["food"],hooks:["cross-series-visit"],loreStatus:"adaptation"}],
  ]);
  add("earth","Ilha Papaya",["tournament"],[
    ["south-city","Cidade do Sul","city",35000,93000,8500,8,{hooks:["sea-commerce"],production:"city"}],
    ["papaya-port","Porto da Ilha Papaya","port",82000,105000,1800,8,{loreStatus:"adaptation",hooks:["ferry","festival-arrival"]}],
    ["tournament-grounds","Terreno do Tenkaichi Budokai","arena",86000,101000,4800,8,{npcIds:["roshi","tien","goku"],hooks:["ranked-tournament","festival"]}],
    ["tournament-preliminaries","Salão das preliminares","interior",84200,99500,800,8,{hooks:["qualifiers"],access:"tournament-grounds"}],
    ["tournament-restaurant","Restaurante do torneio","restaurant",89000,102000,1000,8,{resources:["food"],hooks:["social-hub"],access:"tournament-grounds"}],
  ]);
  add("earth","Santuário Karin",["karin","ribbon"],[
    ["karin-forest","Floresta do Santuário Karin","wilderness",-75500,-55000,7600,8,{resources:["herb","wood","wild-food"],hooks:["guardian-patrol"]}],
    ["karin-village","Aldeia de Bora e Upa","village",-70000,-61500,1800,8,{npcIds:["yajirobe"],hooks:["sanctuary-defense"]}],
    ["sacred-water","Torre Karin","tower",-71500,-68000,1000,9,{npcIds:["korin","yajirobe"],resources:["senzu"],hooks:["climb","senzu-cultivation"],production:"hero-landmark"}],
    ["lookout","Palácio de Kami","sky-sanctuary",-71500,-68000,2300,10,{npcIds:["dende","popo","piccolo"],hooks:["guardian-audience","divine-training"],access:"climb-or-flight"}],
    ["time-chamber","Sala do Espírito e do Tempo","interior",-71000,-68000,600,13,{hooks:["time-dilated-training","party-instance"],access:"lookout-permission",production:"hero-landmark"}],
  ]);
  add("earth","Território Red Ribbon",["ribbon"],[
    ["red-ribbon-hq","Quartel General Red Ribbon","fortress",-145000,-78000,7000,10,{npcIds:["commanderRed","generalBlue","tao"],resources:["alloy","scouter-parts"],hooks:["base-infiltration"],production:"hero-landmark"}],
    ["red-ribbon-barracks","Alojamentos Red Ribbon","district",-149000,-75500,1800,10,{hooks:["enemy-routine","sabotage"]}],
    ["muscle-tower","Torre Músculo","fortress",-176000,-110000,3300,11,{npcIds:["rr-defector"],resources:["alloy"],hooks:["floor-expedition","ribbon-sabotage"],sourceIds:["muscle"]}],
    ["jingle-village","Vila Jingle","village",-177000,-117000,2200,9,{resources:["wood","food"],hooks:["winter-relief"],sourceIds:["muscle"]}],
    ["gero-lab","Laboratório do Dr. Gero","laboratory",-115000,-58000,2700,17,{npcIds:["gero","android16"],resources:["bio-sample","alloy"],hooks:["android-threat"]}],
  ]);
  add("earth","Desertos e planaltos",["baba","yunzabit"],[
    ["yamcha-desert","Deserto de Yamcha","wilderness",-47000,59000,14000,4,{npcIds:["yamcha","puar"],resources:["ore","sand-herb"],hooks:["desert-survival"],loreStatus:"adaptation"}],
    ["baba-palace","Palácio da Vovó Uranai","palace",-62000,79000,3200,8,{npcIds:["yajirobe"],hooks:["afterlife-fighters","fortune-quest"]}],
    ["namu-village","Vila de Namu","village",-85000,59000,2400,5,{resources:["grain","water"],hooks:["water-relief"]}],
    ["yunzabit-highlands","Planalto Yunzabit","wilderness",-173000,-132000,12000,12,{resources:["ore","crystal"],hooks:["remote-expedition"]}],
    ["kami-spaceship","Nave do antigo Kami","ruin",-180000,-135000,1800,12,{resources:["ship-parts"],hooks:["namek-voyage"]}],
    ["babidi-ship","Nave oculta de Babidi","dungeon",-66000,76500,2800,18,{npcIds:["dabura","babidi"],hooks:["majin-arc"],sourceIds:["babidi"]}],
  ]);

  add("namek","Aldeias e lagos",["namek","namekEcology"],[
    ["namek-arrival","Costa da chegada","port",0,0,1600,6,{loreStatus:"adaptation",resources:["ajisa","fish"],hooks:["ship-landing","survival"]}],
    ["namek-tsuno","Vila de Tsuno","village",15000,7000,3400,6,{npcIds:["piccolo"],resources:["ajisa","water"],hooks:["village-life","namek-ajisa"]}],
    ["namek-moori","Vila de Muri","village",-26000,12500,3600,7,{npcIds:["dende"],resources:["ajisa","food"],hooks:["escort","village-defense"]}],
    ["namek-lake","Lagos de Namekusei","wetland",7000,25000,14000,6,{loreStatus:"adaptation",resources:["water","fish","ajisa"],hooks:["ecology","harvest"]}],
    ["namek-ajisa-grove","Bosques de ajisa","forest",-12000,-12000,12500,6,{loreStatus:"adaptation",resources:["ajisa","wood"],hooks:["restoration"]}],
    ["namek-elder","Casa do Grande Patriarca","sanctuary",35000,-26000,2400,9,{npcIds:["nail","dende"],hooks:["potential-unlock","dragon-ball-council"]}],
    ["namek-ship","Nave de Freeza","fortress",-51000,-16000,3800,12,{npcIds:["frieza","zarbon","dodoria"],resources:["scouter-parts","alloy"],hooks:["invasion","ship-raid"],sourceIds:["story"]}],
    ["namek-ginyu-landing","Campo de pouso da Força Ginyu","battlefield",-30000,-29000,3700,13,{npcIds:["ginyu","recoome","jeice"],hooks:["ginyu-event"],sourceIds:["story"]}],
    ["namek-final-battle","Planalto do confronto com Freeza","battlefield",51000,15500,6500,20,{npcIds:["goku","frieza"],hooks:["frieza-world-event"],sourceIds:["story"],loreStatus:"adaptation"}],
  ]);
  add("vegeta","Cidades saiyajins",["broly"],[
    ["vegeta-arrival","Porto espacial saiyajin","port",0,0,3000,7,{loreStatus:"adaptation",hooks:["historical-entry"]}],
    ["vegeta-capital","Capital do Planeta Vegeta","city",29000,8000,11000,9,{loreStatus:"adaptation",hooks:["saiyan-society"],production:"city"}],
    ["vegeta-garrison","Guarnição Saiyajin","fortress",20000,4500,3600,7,{npcIds:["vegeta","nappa","raditz"],resources:["alloy","scouter-parts"],hooks:["saiyan-training"]}],
    ["vegeta-launch","Plataformas de lançamento","port",38000,4000,2600,9,{loreStatus:"adaptation",hooks:["invasion-contracts"]}],
    ["vegeta-royal","Palácio do Rei Vegeta","palace",30500,3000,3000,12,{npcIds:["vegeta"],hooks:["royal-audience"],sourceIds:["broly"]}],
    ["vegeta-bardock-home","Bairro de Bardock","district",-17000,-12000,3800,8,{npcIds:["bardock"],hooks:["family-archive"],loreStatus:"adaptation"}],
    ["vegeta-wastes","Ermos de treinamento saiyajin","wilderness",-44000,28000,16000,9,{loreStatus:"adaptation",resources:["ore","wild-food"],hooks:["great-ape-trial"]}],
  ]);
  add("future","Capital devastada",["future"],[
    ["future-arrival","Abrigo da linha de Trunks","shelter",0,0,2300,10,{loreStatus:"adaptation",hooks:["timeline-entry","resistance"]}],
    ["future-lab","Laboratório do Futuro","laboratory",18000,8500,3000,11,{npcIds:["trunks","bulma"],resources:["alloy","battery"],hooks:["time-machine-repair"]}],
    ["future-ruined-city","Centro urbano em ruínas","city",30000,10000,11000,11,{loreStatus:"adaptation",resources:["salvage","food"],hooks:["survivor-rescue"],production:"city"}],
    ["future-resistance","Refúgio da resistência","shelter",-24000,19000,3500,11,{npcIds:["trunks","futuregohan"],hooks:["patrol-schedule","defense"]}],
    ["future-android-front","Zona de patrulha dos androides","battlefield",47000,-15000,9000,16,{npcIds:["android17","android18"],hooks:["android-hunt"]}],
    ["future-black-front","Distrito de Goku Black","battlefield",-42000,-20000,9500,23,{npcIds:["gokuBlack","zamasu"],hooks:["timeline-crisis"]}],
  ]);
  add("otherworld","Recepção dos espíritos",["snake","kai"],[
    ["otherworld-arrival","Chegada das almas","arrival",1700,1740,250,1,{loreStatus:"adaptation",hooks:["death-arrival"],production:"hero-landmark"}],
    ["enma-office","Palácio e atendimento do Sr. Enma","tribunal",2450,1740,300,1,{npcIds:["enma"],hooks:["afterlife-judgment","revival-permission"],access:"dead-or-special-pass",production:"hero-landmark"}],
    ["otherworld-halo-yard","Pátio das auréolas","social",3900,2200,1000,1,{loreStatus:"adaptation",hooks:["spirit-social","resurrection-request"]}],
    ["snake-entry","Entrada do Caminho da Serpente","route",11000,1740,1200,4,{hooks:["snake-journey"],access:"enma-permission"}],
    ["snake-midpoint","Caminho da Serpente · trecho central","route",42000,4500,2800,5,{loreStatus:"adaptation",hooks:["endurance-trial"]}],
    ["snake-end","Fim do Caminho da Serpente","route",76000,2000,1200,7,{loreStatus:"adaptation",hooks:["kaio-arrival"]}],
    ["otherworld-kaio","Planeta do Senhor Kaioh","sanctuary",82500,1740,3400,8,{npcIds:["kingkai"],hooks:["gravity-training","bubbles-chase","kaio-endurance"],access:"snake-way",production:"hero-landmark"}],
    ["otherworld-tournament","Arena do Outro Mundo","arena",-18000,23000,3700,16,{loreStatus:"adaptation",npcIds:["pikkon"],hooks:["spirit-tournament"]}],
  ]);
  add("demon","Terceiro Mundo Demoníaco",["daima"],[
    ["demon-arrival","Fronteira do Terceiro Mundo","port",0,0,1800,11,{loreStatus:"adaptation",hooks:["realm-entry"]}],
    ["demon-gate","Portão do Reino Demoníaco","portal",25000,-19000,2300,12,{npcIds:["glorio"],hooks:["demon-defense","realm-crossing"]}],
    ["demon-third-market","Mercado do Terceiro Mundo","market",18000,9000,3200,11,{loreStatus:"adaptation",resources:["demon-herb","ore"],hooks:["realm-trade"]}],
    ["demon-panzy-village","Vila de Panzy","village",-26000,18000,2700,11,{npcIds:["panzy"],hooks:["demon-alliance"],loreStatus:"adaptation"}],
    ["demon-first-world","Primeiro Mundo Demoníaco","realm",57000,-45000,13000,23,{npcIds:["gomah","arinsu","neva"],hooks:["tamagami-trials"],access:"demon-world-gate",loreStatus:"adaptation"}],
  ]);
  add("vampa","Ermos de Vampa",["broly"],[
    ["vampa-arrival","Local de pouso em Vampa","port",0,0,2200,13,{loreStatus:"adaptation",hooks:["survival-entry"]}],
    ["vampa-cave","Caverna de Broly e Paragus","cave",23000,18000,2900,13,{npcIds:["broly","paragus","cheelai"],resources:["stone","food"],hooks:["survival-story"]}],
    ["vampa-ba-territory","Território de Ba","wilderness",-27000,26000,11000,15,{npcIds:["broly"],resources:["wild-food"],hooks:["beast-encounter"],loreStatus:"adaptation"}],
    ["vampa-wastes","Ermos ácidos","wilderness",37000,-25000,14000,15,{loreStatus:"adaptation",resources:["ore","crystal"],hooks:["hazard-survival"]}],
  ]);
  add("divine","Planeta de Bills",["beerus"],[
    ["divine-arrival","Terraço de chegada","port",0,0,1300,21,{loreStatus:"adaptation",hooks:["angelic-arrival"]}],
    ["divine-training","Campo de treinamento de Whis","training",16000,8000,3200,22,{npcIds:["whis","goku","vegeta"],hooks:["divine-discipline","god-ki-training"]}],
    ["beerus-temple","Templo de Bills","temple",-18000,-13000,2800,24,{npcIds:["beerus","whis"],hooks:["destroyer-audience"]}],
    ["beerus-orchard","Jardins do planeta de Bills","garden",28000,-21000,9500,21,{loreStatus:"adaptation",resources:["rare-food","divine-herb"],hooks:["angelic-foraging"]}],
  ]);
  add("arena","Mundo do Vazio",["zeno"],[
    ["arena-gate","Portão do Torneio do Poder","portal",0,0,1600,25,{hooks:["tournament-entry"],access:"event-pass"}],
    ["arena-ring","Arena do Torneio do Poder","arena",14000,10000,9000,25,{npcIds:["jiren","hit","goku","vegeta"],hooks:["team-tournament","spectating"],access:"event-pass",production:"hero-landmark"}],
    ["arena-spectators","Arquibancada divina","spectator",-15000,9000,3000,25,{hooks:["spectating"],access:"event-pass",loreStatus:"adaptation"}],
  ]);
  add("yardrat","Assentamentos de Yardrat",["pybara"],[
    ["yardrat-arrival","Área de pouso de Yardrat","port",0,0,1500,11,{loreStatus:"adaptation",hooks:["ship-landing"]}],
    ["yardrat-village","Vila dos yardrats","village",14000,7000,3900,11,{loreStatus:"adaptation",resources:["food","herb"],hooks:["spirit-community"]}],
    ["yardrat-sanctuary","Santuário de Pybara","training",29000,-12000,3900,12,{npcIds:["yardrat-master"],hooks:["yardrat-focus","spirit-control"],production:"hero-landmark"}],
    ["yardrat-meditation","Jardins de meditação","garden",41000,-19000,6500,13,{loreStatus:"adaptation",resources:["rare-herb"],hooks:["meditation","instant-transmission"]}],
    ["yardrat-healing","Casa de cura yardrat","healer",-22000,22000,1700,12,{loreStatus:"adaptation",hooks:["healing-training"]}],
    ["yardrat-invasion-front","Fronte de invasão de Moro","battlefield",-48000,-24000,8000,19,{hooks:["moro-raid"],sourceIds:["pybara"]}],
  ]);
  add("cereal","Cidades e planaltos de Cereal",["cereal","sugar"],[
    ["cereal-arrival","Campo de pouso de Cereal","port",0,0,1800,16,{loreStatus:"adaptation",hooks:["ship-landing"]}],
    ["cereal-sugar-city","Cidade dos Sugarians","city",22000,14000,9000,16,{npcIds:["granolah"],resources:["market-goods"],hooks:["city-trade","reconstruction"],production:"city"}],
    ["cereal-domed-market","Mercado sob a cúpula","market",24500,17000,2200,16,{resources:["food","technology"],hooks:["player-stalls"]}],
    ["cereal-airport","Aeroporto sugarian","port",17000,12500,2600,16,{hooks:["cargo","travel"]}],
    ["cereal-ruins","Ruínas cerealjins","ruin",-27000,-21000,9000,17,{npcIds:["granolah"],resources:["relics","ore"],hooks:["memory","frontier-hunt"]}],
    ["monaito-home","Casa de Monaito","home",-43000,-32000,1800,18,{npcIds:["monaito","granolah"],hooks:["cereal-dragon-balls","healing"]}],
    ["cereal-battlefield","Campo de batalha de Granolah","battlefield",47000,-18000,8000,24,{npcIds:["goku","vegeta","granolah","gas"],hooks:["heeter-event"]}],
  ]);
  add("sadala","Capital e fronteiras de Sadala",["sadala","cabba"],[
    ["sadala-arrival","Porto espacial de Sadala","port",0,0,2300,16,{loreStatus:"adaptation",hooks:["universe-six-entry"]}],
    ["sadala-capital","Capital de Sadala","city",33000,15000,12000,16,{npcIds:["cabba"],resources:["market-goods"],hooks:["saiyan-society","city-commerce"],loreStatus:"adaptation",production:"city"}],
    ["sadala-barracks","Quartel do exército de Sadala","fortress",27000,9000,3200,17,{npcIds:["cabba"],hooks:["patrol-training"]}],
    ["sadala-market","Mercado de Sadala","market",37000,20000,2600,16,{loreStatus:"adaptation",hooks:["player-stalls","trade"]}],
    ["caulifla-turf","Território de Caulifla","district",-34000,18000,7000,18,{npcIds:["caulifla","kale"],hooks:["gang-politics","friendly-sparring"]}],
    ["sadala-border","Estrada da fronteira","route",-15000,-22000,11500,17,{loreStatus:"adaptation",resources:["ore","wild-food"],hooks:["convoy","bandit-event"]}],
  ]);
  add("champa","Domínio do Universo 6",["story"],[
    ["champa-arrival","Ponto de chegada de Vados","port",0,0,1300,23,{loreStatus:"adaptation",hooks:["angelic-arrival"]}],
    ["champa-temple","Templo de Champa","temple",17000,-8000,2900,24,{npcIds:["champa","vados"],hooks:["god-audience"],loreStatus:"adaptation"}],
    ["vados-training","Pátio de Vados","training",-16000,11000,3300,24,{npcIds:["vados"],hooks:["ki-control"],loreStatus:"adaptation"}],
    ["champa-feast","Terraço do banquete","social",20000,17000,1900,23,{loreStatus:"adaptation",resources:["rare-food"],hooks:["cooking-contracts"]}],
  ]);
  // Tsufuru is an optional GT-inspired history branch. Its districts are original
  // game designs until a primary source for exact geography is attached.
  add("tsufuru","Arquivo tsufurujin",[],[
    ["tsufuru-arrival","Acesso ao arquivo histórico","portal",0,0,1500,17,{loreStatus:"adaptation",hooks:["history-entry"]}],
    ["tsufuru-city","Cidade tsufurujin reconstruída","city",27000,9000,10000,17,{loreStatus:"adaptation",resources:["alloy","technology"],hooks:["archaeology","city-trade"],production:"city"}],
    ["tsufuru-laboratories","Laboratórios tsufurujins","laboratory",34000,13000,2600,19,{loreStatus:"adaptation",resources:["technology","battery"],hooks:["machine-research"]}],
    ["tsufuru-ruins","Ruínas do conflito saiyajin","ruin",-33000,-18000,11500,20,{loreStatus:"adaptation",resources:["relics","ore"],hooks:["past-conflict"]}],
  ]);
  add("kanassa","Costas de Kanassa",["kanassa"],[
    ["kanassa-arrival","Costa de chegada de Kanassa","port",0,0,1800,15,{loreStatus:"adaptation",hooks:["historical-entry"]}],
    ["kanassa-village","Aldeia kanassana","village",25000,10000,4500,16,{loreStatus:"adaptation",resources:["fish","water"],hooks:["village-defense"]}],
    ["kanassa-vision-shrine","Local da visão de Bardock","battlefield",-27000,16000,4300,17,{npcIds:["bardock","kanassan"],hooks:["vision-story"],loreStatus:"adaptation"}],
    ["kanassa-invasion","Frente da invasão saiyajin","battlefield",41000,-22000,10000,18,{npcIds:["bardock","shugesh"],hooks:["historical-event"]}],
  ]);
  add("konatsu","Planeta Konats",["konats"],[
    ["konatsu-arrival","Porto de Konats","port",0,0,1800,17,{loreStatus:"adaptation",hooks:["film-instance-entry"]}],
    ["konatsu-village","Vila de Konats","village",21000,11000,4500,17,{loreStatus:"adaptation",resources:["food","wood"],hooks:["music-craft"]}],
    ["konatsu-seal","Santuário do selo de Hirudegarn","sanctuary",-31000,-19000,4200,23,{npcIds:["tapion","hirudegarn"],hooks:["flute-trial","seal-event"],loreStatus:"adaptation"}],
    ["konatsu-south","Planícies da Galáxia do Sul","wilderness",42000,22000,14000,18,{loreStatus:"adaptation",resources:["herb","ore"],hooks:["film-expedition"]}],
  ]);
  add("sacred","Mundo dos Kaioshins",["supreme"],[
    ["sacred-arrival","Chegada ao Mundo dos Kaioshins","port",0,0,1300,21,{loreStatus:"adaptation",hooks:["kaioshin-entry"]}],
    ["kaioshin-temple","Residência dos Kaioshins","temple",17000,-7000,3000,21,{npcIds:["kaioshin","kibito"],hooks:["kaioshin-audience"]}],
    ["elder-kai-ground","Campo do Velho Kaioshin","training",-17000,16000,4200,23,{npcIds:["kaioshin"],hooks:["potential-ritual"],loreStatus:"adaptation"}],
    ["buu-final-ground","Campo da batalha final contra Buu","battlefield",39000,24000,8000,26,{npcIds:["goku","vegeta","kidbuu"],hooks:["buu-world-event"]}],
  ]);
  add("zeno","Palácio de Zen-Oh",["zeno"],[
    ["zeno-arrival","Antecâmara dos universos","portal",0,0,1100,27,{loreStatus:"adaptation",hooks:["summons"],access:"divine-invitation"}],
    ["zeno-palace","Palácio de Zen-Oh","palace",15000,3000,3800,27,{hooks:["multiverse-audience"],access:"divine-invitation"}],
    ["zeno-council","Sala do conselho divino","interior",17000,4300,1200,27,{hooks:["universe-event"],access:"zeno-palace",loreStatus:"adaptation"}],
  ]);
  add("frieza","Planeta Freeza n.º 79",["freeza79"],[
    ["frieza-arrival","Hangar de chegada","port",0,0,2300,17,{hooks:["ship-landing"]}],
    ["frieza-base","Base da Força Freeza","fortress",22000,9000,5500,17,{npcIds:["frieza","ginyu","zarbon","dodoria"],resources:["scouter-parts","alloy"],hooks:["force-politics","invasion-contracts"],loreStatus:"adaptation"}],
    ["frieza-medical","Centro de recuperação","hospital",28000,11000,1500,17,{npcIds:["vegeta"],hooks:["medical-recovery"],loreStatus:"adaptation"}],
    ["frieza-hangars","Hangares imperiais","port",-23000,-13000,4200,18,{loreStatus:"adaptation",resources:["ship-parts","fuel"],hooks:["ship-commerce"]}],
    ["frieza-quarry","Pedreiras da guarnição","quarry",44000,-26000,10000,18,{loreStatus:"adaptation",resources:["ore","crystal"],hooks:["resource-conflict"]}],
  ]);

  // Connections are explicit. No generic teleport connects places that require
  // a vessel, audience, historical instance, death state or portal.
  const ROUTES = [
    ["paozu-trail","grandpa-gohan-house","road",1,[]],
    ["grandpa-gohan-house","frypan-mountain","trail",4,[]],
    ["frypan-mountain","goku-family-house","road",5,[]],
    ["paozu-trail","central-city","long-road",6,["supplies"]],
    ["central-city","west-city","long-road",7,["supplies"]],
    ["central-city","satan-city","long-road",10,["supplies"]],
    ["central-city","cell-arena","wilderness",19,[]],
    ["west-city","capsule-corp","street",7,[]],
    ["west-city","west-market","street",7,[]],
    ["west-city","west-station","street",7,[]],
    ["satan-city","orange-star-school","street",10,[]],
    ["west-city","red-ribbon-hq","long-road",10,["supplies"]],
    ["red-ribbon-hq","muscle-tower","wilderness",11,["cold-gear"]],
    ["red-ribbon-hq","sacred-water","long-road",9,["supplies"]],
    ["karin-village","sacred-water","climb",9,["climb-training"]],
    ["sacred-water","lookout","vertical",10,["guardian-access"]],
    ["lookout","time-chamber","door",13,["guardian-permission"]],
    ["south-coast-port","kame","ferry",3,["ticket-or-vessel"]],
    ["south-city","papaya-port","ferry",8,["ticket-or-vessel"]],
    ["papaya-port","tournament-grounds","road",8,[]],
    ["west-city","south-coast-port","long-road",8,["supplies"]],
    ["namek-arrival","namek-tsuno","wilderness",6,[]],
    ["namek-tsuno","namek-moori","wilderness",7,[]],
    ["namek-moori","namek-elder","wilderness",9,[]],
    ["namek-ship","namek-ginyu-landing","patrol",13,[]],
    ["otherworld-arrival","enma-office","walk",1,["dead-or-special-pass"]],
    ["enma-office","snake-entry","permission",4,["enma-permission"]],
    ["snake-entry","snake-midpoint","endurance",5,["enma-permission"]],
    ["snake-midpoint","snake-end","endurance",7,["enma-permission"]],
    ["snake-end","otherworld-kaio","walk",8,[]],
    ["yardrat-arrival","yardrat-sanctuary","wilderness",12,[]],
    ["cereal-sugar-city","monaito-home","wilderness",18,[]],
    ["sadala-capital","caulifla-turf","road",18,[]],
    ["demon-arrival","demon-gate","wilderness",12,[]],
    ["demon-gate","demon-first-world","portal",23,["demon-world-gate"]],
    ["divine-arrival","divine-training","walk",22,[]],
    ["arena-gate","arena-ring","event",25,["event-pass"]],
    ["sacred-arrival","kaioshin-temple","walk",21,[]],
  ].map(([from,to,mode,level,requirements],i)=>Object.freeze({id:"route-"+String(i+1).padStart(3,"0"),from,to,mode,level,requirements}));

  const WORLD_TRANSITIONS = [
    ["capsule-corp","namek-arrival","spaceship",6,["ship","fuel","navigation"]],
    ["capsule-corp","yardrat-arrival","spaceship",11,["ship","fuel","navigation"]],
    ["capsule-corp","cereal-arrival","spaceship",16,["ship","fuel","navigation"]],
    ["capsule-corp","vampa-arrival","spaceship",13,["ship","fuel","navigation"]],
    ["capsule-corp","frieza-arrival","spaceship",17,["ship","fuel","navigation"]],
    ["capsule-corp","sadala-arrival","angel-or-cosmic-gate",19,["universe-six-access"]],
    ["capsule-corp","vegeta-arrival","historical-instance",9,["timeline-key"]],
    ["capsule-corp","future-arrival","time-machine",11,["timeline-key"]],
    ["capsule-corp","kanassa-arrival","historical-instance",16,["timeline-key"]],
    ["capsule-corp","konatsu-arrival","film-instance",17,["film-key"]],
    ["capsule-corp","tsufuru-arrival","historical-instance",17,["timeline-key"]],
    ["lookout","sacred-arrival","kaioshin-teleport",21,["kaioshin-invitation"]],
    ["lookout","demon-arrival","demon-portal",11,["portal-open"]],
    ["divine-training","arena-gate","divine-event",25,["event-pass"]],
    ["divine-training","champa-arrival","angelic-travel",23,["universe-six-access"]],
    ["divine-training","zeno-arrival","divine-invitation",27,["divine-invitation"]],
    ["enma-office","paozu-trail","revival",1,["revival-permission"]],
  ].map(([from,to,mode,level,requirements],i)=>Object.freeze({id:"transition-"+String(i+1).padStart(3,"0"),from,to,mode,level,requirements,directed:true}));

  const DEATH_ACCESS = Object.freeze({
    trigger:"authoritative-player-death",
    destinationWorld:"otherworld",
    arrivalSite:"otherworld-arrival",
    audienceSite:"enma-office",
    haloWhileDead:true,
    returnRequires:"revival-permission",
    defaultReturnSite:"paozu-trail",
    note:"Permissão para reviver é uma regra de jogo; o atlas não afirma que todo morto no cânone obtém retorno pessoal em Enma.",
  });

  const PRODUCTION_PHASES = Object.freeze([
    {id:"atlas-migration",order:1,scope:"all",deliverables:["Migrar marcos existentes por ID e legacyAnchor","Reposicionar NPCs, missões, objetivos e coleta junto com o marco","Preservar descobertas do jogador via ID estável"]},
    {id:"macro-terrain",order:2,scope:"world",deliverables:["Gerar superfície por bioma e região","Conectar cidades, portos e santuários por rotas com travessias longas","Criar pontos de descanso e acontecimentos entre destinos"]},
    {id:"city-districts",order:3,scope:"city",deliverables:["Construir quarteirões caminháveis","Distribuir NPCs por casa, trabalho e horário","Separar mercado, transporte, treino, saúde e missões por distâncias urbanas"]},
    {id:"landmark-interiors",order:4,scope:"hero-landmark",deliverables:["Construir exterior e interior navegáveis","Adicionar regra de acesso, evento, mentor e estado de era","Vincular entradas e saídas ao mesmo ID do atlas"]},
    {id:"living-ecology",order:5,scope:"biome",deliverables:["Distribuir flora, fauna e depósitos com regeneração","Associar recursos a profissões e rotas comerciais","Simular clima, ciclos e riscos locais"]},
    {id:"operations",order:6,scope:"all",deliverables:["Instrumentar tempo de travessia e densidade de encontros","Inspecionar gargalos e espaços vazios","Ajustar distâncias sem alterar IDs persistidos"]},
  ]);

  const ALIASES = Object.freeze({
    karin:"sacred-water",kaio:"otherworld-kaio",yardrat:"yardrat-sanctuary",
    whis:"divine-training",kame:"kame",lookout:"lookout",
  });
  const SITE_BY_ID = Object.freeze(Object.fromEntries(SITES.map(site=>[site.id,site])));
  const REGION_INDEX = Object.freeze(SITES.reduce((index,site)=>{
    const key=site.world+":"+site.region;
    (index[key]||(index[key]=[])).push(site);
    return index;
  },{}));

  function getWorld(id) { return WORLD_BY_ID[id] || null; }
  function getSite(id) { return SITE_BY_ID[ALIASES[id] || id] || null; }
  function sitesForWorld(world) { return SITES.filter(site=>site.world===world); }
  function sitesForRegion(world,region) { return (REGION_INDEX[world+":"+region]||[]).slice(); }
  function regionsForWorld(world) {
    return [...new Set(sitesForWorld(world).map(site=>site.region))];
  }
  function nearby(world,x,y,radius=5000) {
    return sitesForWorld(world).map(site=>({...site,distance:Math.hypot(x-site.x,y-site.y)}))
      .filter(site=>site.distance<=radius+site.radius)
      .sort((a,b)=>a.distance-b.distance);
  }
  function routesFrom(id) {
    const canonical=ALIASES[id]||id;
    return ROUTES.filter(route=>route.from===canonical||route.to===canonical)
      .concat(WORLD_TRANSITIONS.filter(route=>route.from===canonical));
  }
  function distance(a,b) {
    const from=getSite(a),to=getSite(b);
    if(!from||!to||from.world!==to.world)return null;
    return Math.round(Math.hypot(from.x-to.x,from.y-to.y));
  }
  function estimateWalkMinutes(a,b) {
    const d=distance(a,b);
    return d===null?null:Math.round(d/COORDINATE_SYSTEM.targetWalkUnitsPerMinute);
  }
  function sourcesForSite(id) {
    const site=getSite(id);
    return site?site.sourceIds.map(sourceId=>({id:sourceId,...SOURCES[sourceId]})).filter(source=>source.url):[];
  }
  function validate() {
    const errors=[],seen=new Set();
    for(const site of SITES){
      if(seen.has(site.id))errors.push("duplicate site "+site.id);
      seen.add(site.id);
      const b=WORLD_BY_ID[site.world].bounds;
      if(site.x<b[0]||site.y<b[1]||site.x>b[2]||site.y>b[3])errors.push("out of bounds "+site.id);
      for(const sourceId of site.sourceIds)if(!SOURCES[sourceId])errors.push("unknown source "+sourceId+" in "+site.id);
    }
    for(const route of ROUTES.concat(WORLD_TRANSITIONS)){
      if(!SITE_BY_ID[route.from]||!SITE_BY_ID[route.to])errors.push("missing endpoint "+route.id);
    }
    return errors;
  }

  return Object.freeze({
    VERSION,COORDINATE_SYSTEM,SOURCES,WORLD_PLANS,WORLD_BY_ID,
    SITES,SITE_BY_ID,REGION_INDEX,ROUTES,WORLD_TRANSITIONS,
    PRODUCTION_PHASES,DEATH_ACCESS,ALIASES,LEGACY,
    getWorld,getSite,sitesForWorld,sitesForRegion,regionsForWorld,
    nearby,routesFrom,distance,estimateWalkMinutes,sourcesForSite,validate,
  });
});
