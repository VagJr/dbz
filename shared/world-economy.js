(function (root, factory) {
  const sandbox = typeof module === "object" && module.exports
    ? require("./sandbox")
    : root.UZSandbox;
  const data = factory(sandbox);
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.UZWorldEconomy = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Sandbox) {
  "use strict";

  const professions = {
    explorer: { name: "Explorador", activities: ["survey", "discovery", "escort"], station: null },
    miner: { name: "Minerador", activities: ["gather", "quarry"], station: null },
    botanist: { name: "Botânico", activities: ["gather", "garden"], station: "garden" },
    hunter: { name: "Caçador", activities: ["hunt", "tracking"], station: null },
    fisher: { name: "Pescador", activities: ["gather", "fishing"], station: null },
    engineer: { name: "Engenheiro", activities: ["craft", "repair"], station: "workbench" },
    cook: { name: "Cozinheiro", activities: ["craft", "provision"], station: "workbench" },
    builder: { name: "Construtor", activities: ["build", "project"], station: "workbench" },
    trader: { name: "Comerciante", activities: ["sale", "delivery"], station: "market" },
    martial: { name: "Artista marcial", activities: ["training", "sparring", "event"], station: "dojo" },
  };

  // Existing resource IDs remain authoritative in UZSandbox. Extra resources share that inventory.
  const materials = {
    wood: ["Madeira de construção", "material", 0, 0],
    fiber: ["Fibra resistente", "material", 2, 0],
    stone: ["Pedra de fundação", "material", 0, 0],
    fish: ["Peixe fresco", "food", 2, 1],
    meat: ["Carne de caça", "food", 2, 1],
    clean_water: ["Água potável", "food", 2, 1],
    desert_salt: ["Sal do deserto", "material", 0, 1],
    machine_scrap: ["Sucata mecânica", "material", 0, 2],
    namek_ajisa: ["Ajisa namekuseijin", "flora", 2, 2],
    namek_clay: ["Argila de Namekusei", "material", 0, 2],
    namek_pearl: ["Pérola dos três sóis", "rare", 1, 3],
    saiyan_iron: ["Ferro saiyajin", "material", 0, 3],
    saiyan_hide: ["Couro de treino saiyajin", "material", 2, 3],
    future_circuit: ["Circuito recuperado", "material", 5, 3],
    spirit_petal: ["Pétala espiritual", "flora", 2, 3],
    demon_obsidian: ["Obsidiana demoníaca", "material", 0, 4],
    demon_herb: ["Erva do Reino Demoníaco", "flora", 2, 4],
    vampa_hide: ["Couro de Vampa", "material", 2, 3],
    vampa_bone: ["Osso de Vampa", "material", 0, 3],
    divine_essence: ["Essência de treino divino", "rare", 1, 5],
    void_shard: ["Fragmento da Arena do Vazio", "rare", 1, 5],
    yardrat_silk: ["Seda de Yardrat", "material", 2, 3],
    yardrat_stone: ["Pedra de meditação", "material", 1, 3],
    cereal_grain: ["Grão de Cereal", "food", 2, 3],
    cereal_lens: ["Lente cerealjin", "material", 5, 4],
    sadala_ore: ["Minério de Sadala", "material", 0, 4],
    champa_spice: ["Especiaria do Universo 6", "food", 2, 3],
    tsufuru_core: ["Núcleo tsufurujin", "material", 5, 4],
    kanassa_coral: ["Coral de Kanassa", "material", 2, 3],
    konatsu_resin: ["Resina de Konats", "material", 2, 3],
    kai_seed: ["Semente do Mundo Sagrado", "flora", 2, 5],
    palace_crystal: ["Cristal do palácio", "rare", 1, 5],
    frieza_fuel: ["Combustível imperial", "material", 5, 4],
  };
  const products = {
    travel_ration: ["Ração de viagem", "consumable", 4],
    hunter_ration: ["Ração de caçador", "consumable", 4],
    water_filter: ["Filtro de água portátil", "device", 5],
    fishing_kit: ["Kit de pesca", "tool", 7],
    mining_kit: ["Kit de mineração", "tool", 7],
    repair_kit: ["Kit de reparo", "consumable", 7],
    cargo_capsule: ["Cápsula de carga", "device", 6],
    field_scouter: ["Rastreador de campo", "device", 7],
    capsule_home: ["Cápsula de moradia", "housing", 6],
    reinforced_alloy: ["Liga reforçada", "material", 3],
    gravity_core: ["Núcleo gravitacional", "device", 8],
    ajisa_tonic: ["Tônico de ajisa", "consumable", 4],
    meditation_wrap: ["Faixa de meditação", "equipment", 8],
    training_weights: ["Pesos de treinamento", "equipment", 8],
    survival_suit: ["Traje de sobrevivência", "equipment", 8],
    planet_beacon: ["Farol planetário", "structure", 10],
    market_stall: ["Banca de comércio", "structure", 6],
    ship_part: ["Peça de nave", "ship", 7],
    spirit_incense: ["Incenso espiritual", "consumable", 4],
    ceremonial_banner: ["Estandarte de dojo", "housing", 9],
  };
  const items = {};
  for (const [id, [name, category, sprite, tier]] of Object.entries(materials))
    items[id] = { name, category, tier, sprite: { sheet: "items", index: sprite } };
  for (const [id, [name, category, sprite]] of Object.entries(products))
    items[id] = { name, category, tier: 1, sprite: { sheet: "items", index: sprite } };
  Object.assign(items.field_scouter, { slot: "device", stat: "spirit", bonus: 3 });
  Object.assign(items.meditation_wrap, { slot: "head", stat: "spirit", bonus: 2 });
  Object.assign(items.training_weights, { slot: "hands", stat: "force", bonus: 3 });
  Object.assign(items.survival_suit, { slot: "body", stat: "vitality", bonus: 4 });

  const recipes = [
    ["travel_ration", { fish: 1, cereal_grain: 1, clean_water: 1 }, "cook", 1, false],
    ["hunter_ration", { meat: 2, desert_salt: 1 }, "cook", 2, false],
    ["water_filter", { stone: 2, fiber: 2, alloy: 1 }, "engineer", 2, true],
    ["fishing_kit", { wood: 2, fiber: 3, alloy: 1 }, "engineer", 1, true],
    ["mining_kit", { wood: 2, ore: 3, alloy: 1 }, "engineer", 1, true],
    ["repair_kit", { machine_scrap: 3, alloy: 1, fiber: 1 }, "engineer", 2, true],
    ["cargo_capsule", { alloy: 3, fiber: 2, crystal: 1 }, "engineer", 3, true],
    ["field_scouter", { machine_scrap: 2, future_circuit: 1, crystal: 2 }, "engineer", 5, true],
    ["capsule_home", { reinforced_alloy: 4, wood: 8, fiber: 5 }, "builder", 6, true],
    ["reinforced_alloy", { alloy: 2, saiyan_iron: 2, sadala_ore: 1 }, "engineer", 5, true],
    ["gravity_core", { reinforced_alloy: 2, crystal: 4, tsufuru_core: 1 }, "engineer", 9, true],
    ["ajisa_tonic", { namek_ajisa: 3, namek_clay: 1, clean_water: 1 }, "botanist", 3, true],
    ["meditation_wrap", { yardrat_silk: 3, spirit_petal: 1 }, "martial", 5, true],
    ["training_weights", { saiyan_iron: 4, vampa_hide: 1 }, "martial", 5, true],
    ["survival_suit", { vampa_hide: 3, fiber: 4, reinforced_alloy: 1 }, "engineer", 6, true],
    ["planet_beacon", { reinforced_alloy: 3, battery: 2, cereal_lens: 1 }, "builder", 8, true],
    ["market_stall", { wood: 5, fiber: 4, alloy: 1 }, "builder", 2, true],
    ["ship_part", { frieza_fuel: 2, tsufuru_core: 1, reinforced_alloy: 2 }, "engineer", 8, true],
    ["spirit_incense", { spirit_petal: 2, kai_seed: 1, clean_water: 1 }, "botanist", 8, true],
    ["ceremonial_banner", { yardrat_silk: 2, konatsu_resin: 2, wood: 2 }, "builder", 4, true],
  ].map(([id, cost, profession, professionLevel, station]) => ({
    id, cost, profession, professionLevel, station, skill: Math.min(8, Math.floor(professionLevel / 2)),
  }));

  // Three sparse deposits per 1,600 m cell. Planet-specific weights keep trade routes useful.
  const deposits = {
    earth: { forest: [["herb", 5], ["wood", 5], ["fiber", 3], ["ore", 2], ["fish", 2], ["crystal", 1]], desert: [["ore", 5], ["stone", 4], ["desert_salt", 4], ["crystal", 2]], urban: [["machine_scrap", 5], ["stone", 3], ["fiber", 2], ["ore", 2]] },
    namek: [["namek_ajisa", 5], ["namek_clay", 4], ["fish", 3], ["crystal", 2], ["namek_pearl", 1]],
    vegeta: [["saiyan_iron", 5], ["stone", 3], ["ore", 3], ["saiyan_hide", 2], ["crystal", 1]],
    future: [["future_circuit", 4], ["machine_scrap", 5], ["stone", 2], ["herb", 1]],
    otherworld: [["spirit_petal", 5], ["yardrat_stone", 2], ["crystal", 2]],
    demon: [["demon_obsidian", 5], ["demon_herb", 4], ["stone", 2], ["crystal", 1]],
    vampa: [["vampa_hide", 4], ["vampa_bone", 4], ["stone", 3], ["meat", 2]],
    divine: [["divine_essence", 1], ["spirit_petal", 4], ["crystal", 4]],
    arena: [["void_shard", 2], ["stone", 3], ["crystal", 2]],
    yardrat: [["yardrat_silk", 5], ["yardrat_stone", 4], ["fiber", 3], ["herb", 2]],
    cereal: [["cereal_grain", 5], ["cereal_lens", 1], ["wood", 3], ["stone", 3]],
    sadala: [["sadala_ore", 5], ["saiyan_hide", 2], ["meat", 2], ["wood", 2]],
    champa: [["champa_spice", 5], ["fish", 2], ["fiber", 2], ["crystal", 1]],
    tsufuru: [["tsufuru_core", 2], ["machine_scrap", 5], ["future_circuit", 3], ["stone", 2]],
    kanassa: [["kanassa_coral", 5], ["fish", 4], ["clean_water", 3], ["stone", 2]],
    konatsu: [["konatsu_resin", 5], ["wood", 4], ["fiber", 2], ["herb", 2]],
    sacred: [["kai_seed", 2], ["spirit_petal", 4], ["herb", 3], ["crystal", 2]],
    zeno: [["palace_crystal", 1], ["spirit_petal", 5], ["crystal", 2]],
    frieza: [["frieza_fuel", 4], ["machine_scrap", 4], ["ore", 3], ["crystal", 2]],
  };
  const lootTables = {
    wildlife: [{ item: "meat", weight: 7, min: 1, max: 2 }, { item: "fiber", weight: 3, min: 1, max: 2 }],
    ribbon: [{ item: "machine_scrap", weight: 6, min: 1, max: 2 }, { item: "ore", weight: 3, min: 1, max: 2 }, { item: "future_circuit", weight: 1, min: 1, max: 1 }],
    freeza: [{ item: "frieza_fuel", weight: 4, min: 1, max: 1 }, { item: "machine_scrap", weight: 5, min: 1, max: 2 }, { item: "crystal", weight: 1, min: 1, max: 1 }],
    android: [{ item: "future_circuit", weight: 5, min: 1, max: 2 }, { item: "machine_scrap", weight: 5, min: 1, max: 3 }],
    saiyan: [{ item: "saiyan_iron", weight: 5, min: 1, max: 2 }, { item: "saiyan_hide", weight: 2, min: 1, max: 1 }, { item: "ore", weight: 3, min: 1, max: 2 }],
    demon: [{ item: "demon_obsidian", weight: 4, min: 1, max: 2 }, { item: "demon_herb", weight: 4, min: 1, max: 2 }, { item: "crystal", weight: 2, min: 1, max: 1 }],
    frontier: [{ item: "cereal_grain", weight: 4, min: 1, max: 2 }, { item: "cereal_lens", weight: 1, min: 1, max: 1 }, { item: "stone", weight: 5, min: 1, max: 2 }],
    spirit: [{ item: "spirit_petal", weight: 6, min: 1, max: 2 }, { item: "crystal", weight: 4, min: 1, max: 2 }],
    vampa: [{ item: "vampa_hide", weight: 5, min: 1, max: 2 }, { item: "vampa_bone", weight: 5, min: 1, max: 2 }],
    yardrat: [{ item: "yardrat_stone", weight: 5, min: 1, max: 2 }, { item: "yardrat_silk", weight: 4, min: 1, max: 2 }, { item: "crystal", weight: 1, min: 1, max: 1 }],
    divine: [{ item: "spirit_petal", weight: 6, min: 1, max: 2 }, { item: "divine_essence", weight: 1, min: 1, max: 1 }, { item: "crystal", weight: 3, min: 1, max: 2 }],
    void: [{ item: "void_shard", weight: 4, min: 1, max: 1 }, { item: "crystal", weight: 6, min: 1, max: 2 }],
    boss: [{ item: "crystal", weight: 6, min: 2, max: 4 }, { item: "reinforced_alloy", weight: 4, min: 1, max: 2 }],
    divine_boss: [{ item: "divine_essence", weight: 5, min: 1, max: 2 }, { item: "crystal", weight: 5, min: 2, max: 4 }],
    world_event: [{ item: "ore", weight: 3, min: 2, max: 4 }, { item: "herb", weight: 3, min: 2, max: 4 }, { item: "crystal", weight: 2, min: 1, max: 2 }, { item: "cargo_capsule", weight: 1, min: 1, max: 1 }],
  };
  const activityRewards = {
    discovery: { xp: 20, zenni: 4, reputation: 1, profession: "explorer", loot: null },
    hunt: { xp: 28, zenni: 0, reputation: 0, profession: "hunter", loot: "wildlife" },
    boss: { xp: 120, zenni: 25, reputation: 3, profession: "martial", loot: "boss" },
    world_event: { xp: 85, zenni: 25, reputation: 3, profession: "explorer", loot: "world_event" },
    escort: { xp: 65, zenni: 18, reputation: 2, profession: "explorer", loot: null },
    sparring: { xp: 12, zenni: 0, reputation: 0, profession: "martial", loot: null },
    project: { xp: 45, zenni: 10, reputation: 2, profession: "builder", loot: null },
    delivery: { xp: 35, zenni: 10, reputation: 1, profession: "trader", loot: null },
  };
  const marketRules = {
    maxListings: 2500, maxPerSeller: 12, maxQuantity: 99,
    maxTotalPrice: 1000000, maxZenni: 1000000000000,
    listingFeeRate: 0.01, saleTaxRate: 0.05,
    expiresMs: 14 * 24 * 60 * 60 * 1000,
    receiptsLimit: 2000,
  };
  const rankingMetrics = {
    power: { name: "Poder de luta", unit: "poder", fair: "Poder persistido pelo servidor; empate por nível." },
    exploration: { name: "Exploração", unit: "regiões", fair: "Conta apenas regiões distintas." },
    craft: { name: "Ofícios", unit: "níveis", fair: "Soma dos três ofícios mais desenvolvidos." },
    community: { name: "Comunidade", unit: "contribuições", fair: "Eventos e projetos únicos com participação verificada." },
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  function progressionStage(level) {
    const n = Math.max(1, Math.floor(Number(level) || 1));
    return n <= 20 ? "early" : n <= 60 ? "mid" : n <= 100 ? "end" : "legend";
  }
  function xpToNext(level) {
    const n = clamp(Math.floor(Number(level) || 1), 1, 10000);
    // Never lower the pre-expansion threshold (level * 130), so saved residual XP stays valid.
    return Math.max(130 * n,
      Math.round(100 + 45 * n + 12 * n * n + Math.max(0, n - 50) ** 3 * 0.55));
  }
  function professionXpToNext(level) {
    const n = clamp(Math.floor(Number(level) || 1), 1, 10000);
    return Math.round(30 + 18 * n + 4 * n * n + Math.max(0, n - 30) ** 3 * 0.35);
  }
  function professionLevel(xp) {
    let left = clamp(Math.floor(Number(xp) || 0), 0, 1e12), level = 1;
    while (level < 1000 && left >= professionXpToNext(level)) left -= professionXpToNext(level++);
    return level;
  }
  function hash(value) {
    let h = 2166136261;
    for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return h >>> 0;
  }
  function biomeAt(world, x, y) {
    if (world !== "earth") return "planet";
    if (Math.hypot(x + 7200, y - 6300) < 7500) return "desert";
    if (Math.hypot(x - 10200, y - 3400) < 6000) return "urban";
    return "forest";
  }
  function pickWeighted(rows, n) {
    const total = rows.reduce((sum, row) => sum + row[1], 0);
    let roll = n % total;
    for (const [id, weight] of rows) { if (roll < weight) return id; roll -= weight; }
    return rows[0][0];
  }
  function resourceNodes(world, x, y) {
    if (world === "space" || !world || !Number.isFinite(x) || !Number.isFinite(y)) return [];
    const source = deposits[world] || [["ore", 4], ["herb", 4], ["crystal", 2], ["stone", 3]];
    const cell = 1600, cx = Math.floor(x / cell), cy = Math.floor(y / cell), out = [];
    for (let row = cy - 1; row <= cy + 1; row++) for (let col = cx - 1; col <= cx + 1; col++) {
      for (let slot = 0; slot < 3; slot++) {
        const seed = hash(`${world}:${col}:${row}:${slot}`);
        const px = col * cell + 260 + (seed % 1060);
        const py = row * cell + 260 + ((Math.imul(seed, 2246822519) >>> 0) % 1060);
        const zone = source;
        const table = Array.isArray(zone) ? zone : zone[biomeAt(world, px, py)];
        const kind = pickWeighted(table, hash(`${seed}:resource`));
        out.push({ id: `economy:${world}:${col}:${row}:${slot}`, world, x: px, y: py, kind, name: Sandbox.items[kind]?.name || items[kind]?.name || kind });
      }
    }
    return out;
  }
  function rollLoot(table, seed) {
    const rows = lootTables[table];
    if (!rows) return {};
    const n = hash(seed), row = rows.find((_, i) => {
      const limit = rows.slice(0, i + 1).reduce((sum, r) => sum + r.weight, 0);
      return n % rows.reduce((sum, r) => sum + r.weight, 0) < limit;
    });
    return row ? { [row.item]: row.min + (hash(`${seed}:qty`) % (row.max - row.min + 1)) } : {};
  }
  function activityReward(kind, level = 1, contribution = 1) {
    const base = activityRewards[kind];
    if (!base) return null;
    const l = clamp(Math.floor(Number(level) || 1), 1, 1000);
    const c = clamp(Number(contribution) || 0, 0, 1);
    if (c < 0.1) return null;
    const factor = (1 + Math.min(4, Math.sqrt(l) / 3)) * (0.35 + 0.65 * c);
    return { xp: Math.round(base.xp * factor), bonusZenni: Math.round(base.zenni * factor), reputation: Math.round(base.reputation * c), profession: base.profession, loot: base.loot };
  }
  function installCatalog(sandbox = Sandbox) {
    if (!sandbox?.items || !sandbox.recipes) return;
    for (const [id, item] of Object.entries(items)) if (!sandbox.items[id]) sandbox.items[id] = item;
    const ids = new Set(sandbox.recipes.map(r => r.id));
    for (const recipe of recipes) if (!ids.has(recipe.id)) sandbox.recipes.push({ ...recipe });
    for (const id of ["capsule_home", "planet_beacon", "market_stall", "ceremonial_banner"])
      if (!sandbox.structures[id]) sandbox.structures[id] = {
        name: sandbox.items[id].name, action: "Examinar", seconds: 1, decor: true,
      };
    if (!sandbox.__worldEconomyNodesInstalled) {
      const legacyNodes = sandbox.nodes;
      sandbox.legacyNodes = legacyNodes;
      sandbox.nodes = function (world, x, y) {
        const existing = legacyNodes(world, x, y);
        const extra = resourceNodes(world, x, y)
          .filter(node => existing.every(old => old.id !== node.id &&
            Math.hypot(old.x - node.x, old.y - node.y) >= 140))
          .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y) ||
            a.id.localeCompare(b.id))
          .slice(0, 16);
        return [...existing, ...extra];
      };
      Object.defineProperty(sandbox, "__worldEconomyNodesInstalled", { value: true });
    }
  }
  installCatalog();
  return { version: 1, professions, items, recipes, deposits, lootTables, activityRewards,
    marketRules, rankingMetrics, progressionStage, xpToNext, professionXpToNext,
    professionLevel, hash, biomeAt, resourceNodes, rollLoot, activityReward, installCatalog };
});
