"use strict";
const { randomUUID } = require("node:crypto");
const C = require("../shared/sandbox");
const Economy = require("../shared/world-economy");
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const integer = (value, max = 1e12) =>
  Number.isSafeInteger(value) ? Math.max(0, Math.min(max, value)) : 0;
const result = (ok, message, extra = {}) => ({ ok, message, ...extra });
const rankCache = new WeakMap();
const provisions = {
  travel_ration: { hp: 0.15, ki: 12 },
  hunter_ration: { hp: 0.25, ki: 20 },
  ajisa_tonic: { hp: 0.35, ki: 30 },
  spirit_incense: { hp: 0.05, ki: 40 },
};

function cleanEconomy(saved) {
  const data = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  const proficiency = {};
  for (const id of Object.keys(Economy.professions))
    proficiency[id] = integer(data.proficiency?.[id]);
  return {
    version: 1,
    freeListingUsed: data.freeListingUsed === true,
    activeProfession: owns(Economy.professions, data.activeProfession)
      ? data.activeProfession : "explorer",
    switchedAt: integer(data.switchedAt, 1e15),
    proficiency,
    metrics: {
      gathered: integer(data.metrics?.gathered),
      crafted: integer(data.metrics?.crafted),
      built: integer(data.metrics?.built),
      combatLoot: integer(data.metrics?.combatLoot),
      xpEarned: integer(data.metrics?.xpEarned),
      community: integer(data.metrics?.community),
      sales: integer(data.metrics?.sales),
      purchases: integer(data.metrics?.purchases),
    },
    recentEvents: Array.isArray(data.recentEvents)
      ? [...new Set(data.recentEvents.filter(v => typeof v === "string" && v.length <= 150))].slice(-256)
      : [],
  };
}

function economyWorld(engine) {
  engine.worldMemory ||= {};
  const state = engine.worldMemory.economy ||= {
    version: 1, awarded: {}, ranking: {}, lastPrunedAt: 0,
  };
  state.awarded ||= {};
  state.ranking ||= {};
  return state;
}

function sandboxWorld(engine) {
  const state = engine.sandboxWorld();
  state.market ||= [];
  state.credits ||= {};
  state.marketReturns ||= {};
  state.marketReceipts ||= [];
  state.tradePractice ||= {};
  return state;
}

function totalInventory(p) {
  return Object.values(p.sandbox.inventory).reduce((sum, n) => sum + (Number(n) || 0), 0);
}

function professionGain(p, id, amount) {
  if (!p?.economy || !owns(Economy.professions, id)) return 0;
  const n = integer(amount, 10000);
  if (!n) return 0;
  const gain = Math.round(n * (p.economy.activeProfession === id ? 1.2 : 1));
  p.economy.proficiency[id] = integer(p.economy.proficiency[id] + gain);
  return gain;
}

function rankRecord(p) {
  const levels = ["miner", "botanist", "fisher", "engineer", "cook", "builder"]
    .map(id => p.economy.proficiency[id])
    .map(Economy.professionLevel).sort((a, b) => b - a);
  return {
    id: p.citizenId,
    name: String(p.name || "Guerreiro").slice(0, 24),
    power: /^\d{1,200}$/.test(String(p.power)) ? String(p.power) : "0",
    level: integer(p.level, 100000),
    exploration: Math.min(500, new Set([
      ...(p.sandbox.discoveries || []),
      ...(p.universeDiscoveries || []).map(id => `atlas:${id}`),
    ]).size),
    craft: levels.slice(0, 3).reduce((sum, level) => sum + level, 0),
    community: integer(p.economy.metrics.community),
    updatedAt: Date.now(),
  };
}

function powerCompare(a, b) {
  return b.power.length - a.power.length || b.power.localeCompare(a.power);
}

function rankings(state, metric, limit = 20) {
  if (!owns(Economy.rankingMetrics, metric)) return [];
  let cache = rankCache.get(state);
  if (!cache || cache.revision !== state.rankingRevision) {
    cache = { revision: state.rankingRevision, metrics: {} };
    rankCache.set(state, cache);
  }
  let rows = cache.metrics[metric];
  if (!rows) {
    rows = Object.values(state.ranking);
    if (metric === "power") rows.sort((a, b) =>
      powerCompare(a, b) || b.level - a.level || a.id.localeCompare(b.id));
    else rows.sort((a, b) =>
      (b[metric] || 0) - (a[metric] || 0) ||
      b.level - a.level || a.id.localeCompare(b.id));
    cache.metrics[metric] = rows;
  }
  return rows.slice(0, Math.min(50, Math.max(1, Math.floor(limit) || 20)))
    .map((row, index) => ({ rank: index + 1, ...row }));
}

function pruneEconomy(state, now = Date.now()) {
  if (now - (state.lastPrunedAt || 0) < 60000) return;
  state.lastPrunedAt = now;
  for (const [key, when] of Object.entries(state.awarded))
    if (!Number.isFinite(when) || now - when > 30 * 24 * 3600 * 1000)
      delete state.awarded[key];
  const keys = Object.keys(state.awarded);
  if (keys.length > 20000) {
    keys.sort((a, b) => state.awarded[a] - state.awarded[b]);
    for (const key of keys.slice(0, keys.length - 20000)) delete state.awarded[key];
  }
  const entries = Object.entries(state.ranking);
  if (entries.length > 20000) {
    entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
    state.ranking = Object.fromEntries(entries.slice(0, 20000));
  }
}

function marketCleanup(world, now = Date.now()) {
  const keep = [];
  for (const offer of world.market) {
    if (!offer.expiresAt || offer.expiresAt > now) { keep.push(offer); continue; }
    if (typeof offer.owner === "string" && owns(C.items, offer.item) &&
        Number.isSafeInteger(offer.qty) && offer.qty > 0) {
      const returns = world.marketReturns[offer.owner] ||= {};
      returns[offer.item] = integer((returns[offer.item] || 0) + offer.qty);
    }
  }
  world.market = keep;
  world.marketReceipts = world.marketReceipts.slice(-Economy.marketRules.receiptsLimit);
}

function interactionAllowed(engine, p) {
  if (!p || p.state === "dead" || p.hp <= 0) return "Você não pode negociar agora.";
  if (engine.time - p.lastHit < 5 || p.chargeAt !== null || p.training)
    return "Encerre o combate ou treinamento antes de negociar.";
  if (p.world === "space" || p.ascent || p.altitude > 0.1)
    return "Pouse em um planeta para negociar.";
  if (p.sandboxJob) return "Conclua ou cancele a atividade atual.";
  if (engine.time < p.sandboxCooldown) return "Aguarde um instante.";
  p.sandboxCooldown = engine.time + 0.25;
  return null;
}

function marketCommand(engine, p, data) {
  const blocked = interactionAllowed(engine, p);
  if (blocked) return result(false, blocked);
  const w = sandboxWorld(engine), rules = Economy.marketRules, now = Date.now();
  marketCleanup(w, now);
  const owner = p.citizenId;
  if (data.action === "sell") {
    const { item, qty, price } = data;
    if (!owns(C.items, item) || !Number.isSafeInteger(qty) || qty < 1 ||
        qty > rules.maxQuantity || !Number.isSafeInteger(price) || price < 1 ||
        price > rules.maxTotalPrice)
      return result(false, "Oferta inválida: quantidade ou preço fora dos limites.");
    const tier = integer(C.items[item].tier, 10);
    if (price < qty * Math.max(1, tier * 2))
      return result(false, "O preço não cobre o valor mínimo deste lote.");
    if (w.market.length >= rules.maxListings ||
        w.market.filter(v => v.owner === owner).length >= rules.maxPerSeller)
      return result(false, "Limite de ofertas atingido.");
    // A newcomer's first listing is free, so gathering can lead directly to trade.
    const fee = p.economy.freeListingUsed
      ? Math.max(1, Math.ceil(price * rules.listingFeeRate)) : 0;
    if (!Number.isSafeInteger(p.zenni) || p.zenni < fee)
      return result(false, "Zenni insuficiente para a taxa de publicação.");
    if (!engine.sandboxPay(p, { [item]: qty }))
      return result(false, "Itens insuficientes.");
    p.zenni -= fee;
    p.economy.freeListingUsed = true;
    const id = randomUUID();
    w.market.push({ id, owner, seller: p.name, item, qty, price,
      world: p.world, createdAt: now, expiresAt: now + rules.expiresMs,
      postingFee: fee, version: 2 });
    engine.economyRankRefresh(p);
    return result(true, `Oferta publicada. Taxa: ${fee} zenni.`, { listingId: id });
  }
  if (data.action === "buy") {
    const offer = w.market.find(v => v.id === data.target);
    if (!offer || offer.world !== p.world || offer.owner === owner ||
        !owns(C.items, offer.item) || !Number.isSafeInteger(offer.qty) ||
        offer.qty < 1 || offer.qty > rules.maxQuantity ||
        !Number.isSafeInteger(offer.price) || offer.price < 1 ||
        offer.price > rules.maxTotalPrice)
      return result(false, "Oferta indisponível.");
    if (!Number.isSafeInteger(p.zenni) || p.zenni < offer.price)
      return result(false, "Zenni insuficiente.");
    const tax = Math.max(1, Math.ceil(offer.price * rules.saleTaxRate));
    const payout = offer.price - tax;
    const credit = integer(w.credits[offer.owner], rules.maxZenni);
    if (credit + payout > rules.maxZenni)
      return result(false, "O vendedor precisa receber vendas pendentes primeiro.");
    if (totalInventory(p) + offer.qty > C.capacity ||
        !engine.sandboxPay(p, {}, { [offer.item]: offer.qty }))
      return result(false, "Mochila cheia.");
    p.zenni -= offer.price;
    w.credits[offer.owner] = credit + payout;
    w.market = w.market.filter(v => v !== offer);
    w.marketReceipts.push({ id: randomUUID(), listing: offer.id, buyer: owner,
      seller: offer.owner, item: offer.item, qty: offer.qty, gross: offer.price,
      tax, paid: payout, world: offer.world, at: now });
    w.marketReceipts = w.marketReceipts.slice(-rules.receiptsLimit);
    p.economy.metrics.purchases++;
    const seller = [...engine.players.values()].find(v => v.citizenId === offer.owner);
    if (seller) {
      seller.economy.metrics.sales++;
      professionGain(seller, "trader", 12);
      engine.economyRankRefresh(seller);
    } else {
      const pending = w.tradePractice[offer.owner] ||= { xp: 0, sales: 0 };
      pending.xp = integer(pending.xp + 12);
      pending.sales = integer(pending.sales + 1);
    }
    engine.economyRankRefresh(p);
    engine.sandboxLog(p, `Compra: ${offer.qty} ${C.items[offer.item].name}`);
    return result(true, `Compra concluída. ${tax} zenni recolhidos em taxa de mercado.`, { receipt: w.marketReceipts.at(-1).id });
  }
  if (data.action === "cancelSale") {
    const offer = w.market.find(v => v.id === data.target);
    if (!offer || offer.owner !== owner) return result(false, "Oferta não pertence a você.");
    if (!engine.sandboxPay(p, {}, { [offer.item]: offer.qty }))
      return result(false, "Abra espaço na mochila.");
    w.market = w.market.filter(v => v !== offer);
    return result(true, "Oferta cancelada e itens devolvidos.");
  }
  if (data.action === "collectSales") {
    const value = integer(w.credits[owner], rules.maxZenni);
    if (!Number.isSafeInteger(p.zenni) || p.zenni + value > rules.maxZenni)
      return result(false, "Seu saldo atingiu o limite; use parte do zenni antes de receber.");
    p.zenni += value;
    delete w.credits[owner];
    let returned = 0;
    const pending = w.marketReturns[owner] || {};
    for (const [item, qty] of Object.entries(pending)) {
      if (!owns(C.items, item) || !Number.isSafeInteger(qty) || qty < 1) continue;
      const amount = Math.min(qty, C.capacity - totalInventory(p));
      if (amount > 0 && engine.sandboxPay(p, {}, { [item]: amount })) {
        returned += amount;
        pending[item] -= amount;
        if (!pending[item]) delete pending[item];
      }
    }
    if (!Object.keys(pending).length) delete w.marketReturns[owner];
    return result(true, `${value} zenni recebidos; ${returned} itens expirados devolvidos.`);
  }
  return result(false, "Ação de mercado desconhecida.");
}

function lootFamily(enemy) {
  if (enemy.boss) return ["divine", "sacred", "zeno"].includes(enemy.world) ? "divine_boss" : "boss";
  if (enemy.event) return "world_event";
  if (enemy.world === "otherworld" || enemy.world === "sacred") return "spirit";
  if (enemy.world === "vampa") return "vampa";
  if (enemy.world === "yardrat") return "yardrat";
  if (enemy.world === "divine" || enemy.world === "zeno" || enemy.world === "champa") return "divine";
  if (enemy.world === "arena") return "void";
  const id = `${enemy.family || ""} ${enemy.ecologyFamily || ""} ${enemy.skin || ""} ${enemy.name || ""}`.toLowerCase();
  if (/android|drone|circuit/.test(id)) return "android";
  if (/freeza|frieza|ginyu|jeice|zarbon|dodoria/.test(id)) return "freeza";
  if (/saiyan|saiyajin|vegeta|nappa|raditz/.test(id)) return "saiyan";
  if (/demon|gomah|glorio/.test(id)) return "demon";
  if (/ribbon|soldier|soldado/.test(id)) return "ribbon";
  if (enemy.world === "cereal") return "frontier";
  return "wildlife";
}

function install(Engine) {
  if (Engine.prototype.__worldEconomyInstalled) return;
  Economy.installCatalog(C);
  const previous = {
    addPlayer: Engine.prototype.addPlayer,
    profile: Engine.prototype.profile,
    snapshot: Engine.prototype.snapshot,
    sandboxCommand: Engine.prototype.sandboxCommand,
    sandboxFinish: Engine.prototype.sandboxFinish,
    reward: Engine.prototype.reward,
    damage: Engine.prototype.damage,
  };
  if (!previous.sandboxCommand || !previous.sandboxFinish)
    throw Error("Instale world-economy depois de src/sandbox.");
  Object.defineProperty(Engine.prototype, "__worldEconomyInstalled", { value: true });

  Engine.prototype.economyWorld = function () { return economyWorld(this); };
  Engine.prototype.economyRankRefresh = function (p) {
    if (!p?.economy || !p.citizenId) return;
    const state = economyWorld(this);
    state.ranking[p.citizenId] = rankRecord(p);
    state.rankingRevision = integer((state.rankingRevision || 0) + 1);
    pruneEconomy(state);
  };
  Engine.prototype.economyRankings = function (metric = "power", limit = 20) {
    return rankings(economyWorld(this), metric, limit);
  };
  Engine.prototype.addPlayer = function (id, data = {}) {
    const p = previous.addPlayer.call(this, id, data);
    p.economy = cleanEconomy(data.creation ? {} : data.economy);
    const world = sandboxWorld(this), pending = world.tradePractice[p.citizenId];
    if (pending) {
      professionGain(p, "trader", integer(pending.xp));
      p.economy.metrics.sales = integer(p.economy.metrics.sales + integer(pending.sales));
      delete world.tradePractice[p.citizenId];
    }
    this.economyRankRefresh(p);
    return p;
  };
  Engine.prototype.profile = function (p) {
    return { ...previous.profile.call(this, p), economy: structuredClone(p.economy) };
  };
  Engine.prototype.reward = function (p, xp) {
    if (!p) return;
    const gain = Number.isFinite(xp) ? Math.max(0, Math.min(1e9, xp)) : 0;
    if (!gain) return;
    p.level = Number.isSafeInteger(p.level) && p.level > 0 ? p.level : 1;
    p.xp = Number.isFinite(p.xp)
      ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, p.xp)) : 0;
    p.xp = Math.min(Number.MAX_SAFE_INTEGER, p.xp + gain);
    p.power = (BigInt(/^\d{1,200}$/.test(String(p.power)) ? p.power : "0") + BigInt(Math.ceil(gain * 2))).toString();
    p.zenni = Math.min(Number.MAX_SAFE_INTEGER,
      (Number.isFinite(p.zenni) ? Math.max(0, p.zenni) : 0) + Math.ceil(gain / 2));
    let levelUps = 0;
    while (levelUps++ < 256 && p.level < Number.MAX_SAFE_INTEGER &&
           p.xp >= Economy.xpToNext(p.level)) {
      p.xp -= Economy.xpToNext(p.level);
      p.level++;
      p.points += 3;
      p.maxHp += 12;
      p.hp = p.maxHp;
      this.emit("level", p, { text: `NÍVEL ${p.level}` });
    }
    if (p.economy) {
      p.economy.metrics.xpEarned = integer(p.economy.metrics.xpEarned + Math.ceil(gain));
      this.economyRankRefresh(p);
    }
  };
  Engine.prototype.sandboxCommand = function (id, data) {
    const p = this.players.get(id);
    if (!p || !data || typeof data !== "object" || Array.isArray(data))
      return previous.sandboxCommand.call(this, id, data);
    if (["sell", "buy", "cancelSale", "collectSales"].includes(data.action))
      return marketCommand(this, p, data);
    if (data.action === "use" && owns(provisions, data.item)) {
      const blocked = interactionAllowed(this, p);
      if (blocked) return result(false, blocked);
      if (Date.now() < p.sandbox.useAt) return result(false, "Aguarde 20 segundos entre consumíveis.");
      const effect = provisions[data.item];
      if (p.hp >= p.maxHp && p.ki >= 100) return result(false, "Vida e ki já estão cheios.");
      if (!this.sandboxPay(p, { [data.item]: 1 })) return result(false, "Consumível indisponível.");
      p.sandbox.useAt = Date.now() + 20000;
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * effect.hp);
      p.ki = Math.min(100, p.ki + effect.ki);
      this.emit("heal", p);
      return result(true, `${C.items[data.item].name} utilizado.`);
    }
    if (data.action === "repair") {
      const blocked = interactionAllowed(this, p);
      if (blocked) return result(false, blocked);
      const building = this.sandboxWorld().structures.find(v => v.id === data.target);
      if (!building || building.owner !== p.citizenId || building.world !== p.world ||
          Math.hypot(building.x - p.x, building.y - p.y) > 180 ||
          building.readyAt <= Date.now())
        return result(false, "Aproxime-se de uma construção sua que esteja recarregando.");
      if (!this.sandboxPay(p, { repair_kit: 1 })) return result(false, "Falta um kit de reparo.");
      building.readyAt = Date.now();
      professionGain(p, "engineer", 8);
      this.economyRankRefresh(p);
      return result(true, "Construção reparada e disponível.");
    }
    if (data.action === "profession") {
      if (!owns(Economy.professions, data.profession))
        return result(false, "Profissão desconhecida.");
      if (p.state === "dead" || p.hp <= 0)
        return result(false, "Escolha a profissão quando estiver vivo.");
      if (p.economy.activeProfession !== data.profession &&
          Date.now() - p.economy.switchedAt < 10 * 60 * 1000)
        return result(false, "Espere 10 minutos antes de mudar de profissão.");
      p.economy.activeProfession = data.profession;
      p.economy.switchedAt = Date.now();
      this.economyRankRefresh(p);
      return result(true, `Profissão ativa: ${Economy.professions[data.profession].name}.`);
    }
    if (data.action === "craft") {
      const recipe = Economy.recipes.find(r => r.id === data.recipe);
      if (recipe && Economy.professionLevel(p.economy.proficiency[recipe.profession]) < recipe.professionLevel)
        return result(false, `A receita exige nível ${recipe.professionLevel} em ${Economy.professions[recipe.profession].name}.`);
    }
    const before = p.sandbox.reputation;
    const response = previous.sandboxCommand.call(this, id, data);
    if (response?.ok && data.action === "contract" && p.sandbox.reputation > before)
      professionGain(p, "trader", 15);
    if (response?.ok && data.action === "project" && p.sandbox.reputation > before) {
      professionGain(p, "builder", 20);
      const key = `project:${p.world}:${this.sandboxWorld().projects[p.world]?.level || 0}:${p.citizenId}`;
      const state = economyWorld(this);
      if (!state.awarded[key]) { state.awarded[key] = Date.now(); p.economy.metrics.community++; }
    }
    if (response?.ok) this.economyRankRefresh(p);
    return response;
  };
  Engine.prototype.sandboxFinish = function (p, job) {
    const before = {
      gather: p.sandbox.practice.gather,
      craft: p.sandbox.practice.craft,
      focus: p.sandbox.practice.focus,
      discoveries: p.sandbox.discoveries.length,
      buildings: this.sandboxWorld().structures.length,
    };
    const resource = job.kind === "gather"
      ? this.sandboxObjects(p).find(v => v.id === job.target && v.type === "resource")
      : null;
    const output = previous.sandboxFinish.call(this, p, job);
    if (job.kind === "gather" && p.sandbox.practice.gather > before.gather) {
      const item = resource?.kind;
      const category = C.items[item]?.category;
      const profession = item === "fish" ? "fisher"
        : category === "flora" || item === "herb" ? "botanist"
        : ["meat", "vampa_hide", "saiyan_hide", "vampa_bone"].includes(item) ? "hunter" : "miner";
      professionGain(p, profession, 9 + integer(C.items[item]?.tier, 10) * 2);
      const baseline = 2 + (p.sandbox.path === "explorer" ? 1 : 0);
      p.economy.metrics.gathered += baseline;
      const kit = profession === "miner" ? "mining_kit" : profession === "fisher" ? "fishing_kit" : null;
      if (kit && p.economy.activeProfession === profession && p.sandbox.inventory[kit] > 0 &&
          this.sandboxPay(p, {}, { [item]: 1 }))
        p.economy.metrics.gathered++;
      if (resource && this.sandboxWorld().depleted[resource.id])
        this.sandboxWorld().depleted[resource.id] = Date.now() + 45000 + integer(C.items[item]?.tier, 10) * 30000;
    }
    if (job.kind === "craft" && p.sandbox.practice.craft > before.craft) {
      const recipe = Economy.recipes.find(r => r.id === job.recipe);
      professionGain(p, recipe?.profession || "engineer", 12 + (recipe?.professionLevel || 1) * 2);
      p.economy.metrics.crafted++;
    }
    if (job.kind === "build" && this.sandboxWorld().structures.length > before.buildings) {
      professionGain(p, "builder", 20);
      p.economy.metrics.built++;
    }
    if (p.sandbox.discoveries.length > before.discoveries)
      professionGain(p, "explorer", 18);
    if (p.sandbox.practice.focus > before.focus)
      professionGain(p, "martial", p.sandbox.practice.focus - before.focus);
    this.economyRankRefresh(p);
    return output;
  };
  Engine.prototype.economyRewardActivity = function (id, activity) {
    const p = this.players.get(id);
    if (!p || !activity || activity.serverVerified !== true ||
        typeof activity.id !== "string" || !/^[a-zA-Z0-9:_-]{8,128}$/.test(activity.id) ||
        !owns(Economy.activityRewards, activity.kind) ||
        (activity.world && activity.world !== p.world))
      return result(false, "Atividade não verificada.");
    const state = economyWorld(this), key = `${p.citizenId}:${activity.id}`;
    if (state.awarded[key] || p.economy.recentEvents.includes(activity.id))
      return result(false, "Recompensa já recebida.");
    const reward = Economy.activityReward(activity.kind, activity.level || p.level, activity.contribution);
    if (!reward) return result(false, "Participação insuficiente.");
    state.awarded[key] = Date.now();
    p.economy.recentEvents.push(activity.id);
    p.economy.recentEvents = p.economy.recentEvents.slice(-256);
    this.reward(p, reward.xp);
    p.zenni = Math.min(Economy.marketRules.maxZenni, p.zenni + reward.bonusZenni);
    p.sandbox.reputation = integer(p.sandbox.reputation + reward.reputation);
    professionGain(p, reward.profession, Math.max(1, Math.round(reward.xp / 5)));
    if (["world_event", "escort", "project"].includes(activity.kind))
      p.economy.metrics.community++;
    const loot = reward.loot ? Economy.rollLoot(reward.loot, key) : {};
    const awardedLoot = this.sandboxPay(p, {}, loot) ? loot : {};
    this.economyRankRefresh(p);
    pruneEconomy(state);
    return result(true, "Recompensa recebida.", {
      xp: reward.xp, zenni: Math.ceil(reward.xp / 2) + reward.bonusZenni,
      reputation: reward.reputation, items: awardedLoot,
    });
  };
  Engine.prototype.damage = function (attacker, target, amount, heavy = false) {
    const alive = target && !target.dead && target.hp > 0;
    const beforeHp = target?.hp;
    const source = this.players.get(attacker?.id);
    if (alive && target.economyLootResolved) {
      target.economyLootResolved = false;
      target.economyContributions = new Map();
    }
    const output = previous.damage.call(this, attacker, target, amount, heavy);
    if (alive && source && !this.players.has(target.id) && !target.practiceOwner && target.hp < beforeHp) {
      target.economyContributions ||= new Map();
      const record = target.economyContributions.get(source.id) || { damage: 0, at: 0 };
      record.damage += beforeHp - target.hp;
      record.at = this.time;
      target.economyContributions.set(source.id, record);
    }
    if (!alive || !target?.dead || target.practiceOwner || target.economyLootResolved)
      return output;
    target.economyLootResolved = true;
    const family = lootFamily(target);
    const deathId = `${target.world}:${target.id}:${Date.now()}`;
    const total = [...(target.economyContributions?.values() || [])].reduce((n, entry) => n + entry.damage, 0);
    for (const [id, record] of target.economyContributions || []) {
      const p = this.players.get(id);
      if (!p || p.state === "dead" || p.world !== target.world || this.time - record.at > 60 ||
          Math.hypot(p.x - target.x, p.y - target.y) > 1100 ||
          id !== source?.id && record.damage / Math.max(1, total) < .1) continue;
      const seed = `${deathId}:${p.citizenId}`;
      const chance = target.boss || target.event || Economy.hash(`${seed}:drop`) % 100 < 75;
      const loot = chance ? Economy.rollLoot(family, seed) : {};
      if (Object.keys(loot).length) {
        if (this.sandboxPay(p, {}, loot)) {
          p.economy.metrics.combatLoot += Object.values(loot)[0];
          const [item, qty] = Object.entries(loot)[0];
          this.sandboxLog(p, `Espólio: +${qty} ${C.items[item].name}`);
        } else this.sandboxLog(p, "Sem espaço para recolher o espólio. Libere sua mochila antes de lutar.");
      }
      professionGain(p, target.boss ? "martial" : "hunter", target.boss ? 20 : 7);
      if (target.event) this.economyRewardActivity(p.id, {
        id: "event:" + deathId, kind: "world_event", world: p.world,
        level: target.level || p.level, contribution: Math.min(1, record.damage / Math.max(1, total)),
        serverVerified: true,
      });
      this.economyRankRefresh(p);
    }
    return output;
  };
  Engine.prototype.snapshot = function (id) {
    const market = sandboxWorld(this);
    if (Date.now() - (market.marketCleanupAt || 0) > 60000) {
      market.marketCleanupAt = Date.now();
      marketCleanup(market);
    }
    const out = previous.snapshot.call(this, id), p = this.players.get(id);
    if (!out || !p) return out;
    out.self.economy = structuredClone(p.economy);
    out.self.citizenId = p.citizenId;
    out.economy = {
      professions: Object.fromEntries(Object.keys(Economy.professions).map(key =>
        [key, Economy.professionLevel(p.economy.proficiency[key])])),
      progression: {
        stage: Economy.progressionStage(p.level), level: p.level,
        xp: p.xp, next: Economy.xpToNext(p.level),
      },
      rankings: Object.fromEntries(Object.keys(Economy.rankingMetrics).map(key =>
        [key, this.economyRankings(key, 10)])),
      marketRules: Economy.marketRules,
    };
    return out;
  };
}

module.exports = install;
module.exports.cleanEconomy = cleanEconomy;
module.exports.rankings = rankings;
module.exports.marketCleanup = marketCleanup;
