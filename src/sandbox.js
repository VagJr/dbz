"use strict";
const C = require("../shared/sandbox");
const { WORLDS } = require("../shared/content");
const Avatar = require("../shared/avatar");
const { randomUUID } = require("node:crypto");
const int = (x, max = 1000000) =>
  Number.isFinite(x) ? Math.max(0, Math.min(max, Math.floor(x))) : 0;
const near = (a, b, r = 130) =>
  a.world === b.world && Math.hypot(a.x - b.x, a.y - b.y) <= r;
const count = (inv) => Object.values(inv).reduce((a, b) => a + b, 0);
const owns = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
function clean(saved = {}) {
  if (!saved || typeof saved !== "object") saved = {};
  const inventory = {};
  let remaining = C.capacity;
  for (const key of Object.keys(C.items)) {
    const n = Math.min(remaining, int(saved.inventory?.[key], C.capacity));
    inventory[key] = n;
    remaining -= n;
  }
  return {
    version: 1,
    useAt: int(saved.useAt, 1e14),
    equipment: Object.fromEntries(Object.keys(C.slots).map(slot=>[slot, C.items[saved.equipment?.[slot]]?.slot===slot?saved.equipment[slot]:null])),
    inventory,
    path: owns(C.paths, saved.path) ? saved.path : "explorer",
    practice: {
      gather: int(saved.practice?.gather),
      craft: int(saved.practice?.craft),
      focus: int(saved.practice?.focus),
    },
    reputation: int(saved.reputation),
    discoveries: Array.isArray(saved.discoveries)
      ? [
          ...new Set(
            saved.discoveries.filter(
              (s) => typeof s === "string" && s.length < 90,
            ),
          ),
        ].slice(-500)
      : [],
    contracts:
      typeof saved.contracts === "object" && saved.contracts
        ? Object.fromEntries(
            C.contracts.map((c) => [c.id, int(saved.contracts[c.id], 1e14)]),
          )
        : {},
    journal: Array.isArray(saved.journal)
      ? saved.journal
          .filter((s) => typeof s === "string")
          .slice(-25)
          .map((s) => s.slice(0, 140))
      : [],
    legacy: int(saved.legacy),
    focus: ["force", "spirit", "vitality"].includes(saved.focus)
      ? saved.focus
      : "spirit",
  };
}
module.exports = (Engine) => {
  const add = Engine.prototype.addPlayer,
    profile = Engine.prototype.profile,
    snapshot = Engine.prototype.snapshot,
    tick = Engine.prototype.tick,
    act = Engine.prototype.act;
  Engine.prototype.sandboxWorld = function () {
    this.worldMemory ||= {};
    const w = (this.worldMemory.sandbox ||= {
      version: 1,
      structures: [],
      depleted: {},
      market: [],
      credits: {},
      projects: {},
      serial: 0,
    });
    return w;
  };
  Engine.prototype.addPlayer = function (id, data = {}) {
    const p = add.call(this, id, data);
    p.citizenId = /^[a-f0-9-]{36}$/.test(data.citizenId || "")
      ? data.citizenId
      : randomUUID();
    p.sandbox = clean(data.sandbox);
    p.appearance = Avatar.clean(data.appearance || data.creation?.appearance);
    p.background = Object.hasOwn(Avatar.backgrounds, data.background || data.creation?.background) ? data.background || data.creation.background : 'wanderer';
    if (!data.sandbox && data.creation) {
      Object.assign(p.sandbox.inventory, Avatar.backgrounds[p.background].items);
      p.sandbox.path = Object.hasOwn(C.paths,data.creation.path)?data.creation.path:'explorer';
      Object.assign(p.sandbox.equipment,{body:'gear_014',feet:'gear_056',hands:'gear_070'});
    }
    p.gearBonus={force:0,spirit:0,vitality:0};
    this.sandboxGear(p);
    p.sandboxJob = null;
    p.sandboxCooldown = 0;
    return p;
  };
  Engine.prototype.sandboxGear = function(p){
    const next={force:0,spirit:0,vitality:0};for(const key of Object.values(p.sandbox.equipment)){const item=C.items[key];if(item?.slot)next[item.stat]+=item.bonus;}
    const previous=p.gearBonus||{force:0,spirit:0,vitality:0};
    for(const stat of Object.keys(next))p.stats[stat]+=next[stat]-previous[stat];
    p.maxHp+=(next.vitality-previous.vitality)*18;p.hp=Math.min(p.hp,p.maxHp);p.gearBonus=next;
  };
  Engine.prototype.profile = function (p) {
    return {
      ...profile.call(this, p),
      citizenId: p.citizenId,
      appearance: p.appearance,
      background: p.background,
      stats: Object.fromEntries(Object.entries(p.stats).map(([key,value])=>[key,value-(p.gearBonus?.[key]||0)])),
      sandbox: structuredClone(p.sandbox),
    };
  };
  Engine.prototype.sandboxLog = function (p, text) {
    p.sandbox.journal.push(text);
    p.sandbox.journal = p.sandbox.journal.slice(-25);
  };
  Engine.prototype.sandboxObjects = function (p) {
    const w = this.sandboxWorld();
    const now = Date.now();
    return [
      ...C.nodes(p.world, p.x, p.y).map((n) => ({
        ...n,
        type: "resource",
        ready: !(w.depleted[n.id] > now),
      })),
      ...w.structures
        .filter((s) => near(p, s, 1700))
        .map((s) => ({
          ...s,
          type: "structure",
          name: C.structures[s.kind].name,
          owned: s.owner === p.citizenId,
          ready: !(s.readyAt > now),
        })),
    ];
  };
  Engine.prototype.sandboxPay = function (p, cost, output = {}) {
    const inv = p.sandbox.inventory;
    for (const [k, n] of Object.entries(cost))
      if (!owns(C.items, k) || inv[k] < n) return false;
    const after =
      count(inv) -
      Object.values(cost).reduce((a, b) => a + b, 0) +
      Object.values(output).reduce((a, b) => a + b, 0);
    if (after > C.capacity) return false;
    for (const [k, n] of Object.entries(cost)) inv[k] -= n;
    for (const [k, n] of Object.entries(output)) inv[k] += n;
    return true;
  };
  Engine.prototype.sandboxCommand = function (id, data) {
    const p = this.players.get(id);
    const fail = (message) => ({ ok: false, message });
    const ok = (message) => ({ ok: true, message });
    if (
      !p ||
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      typeof data.action !== "string"
    )
      return fail("Comando inválido.");
    if (data.action === "cancel") {
      p.sandboxJob = null;
      return ok("Atividade cancelada.");
    }
    if (this.time < p.sandboxCooldown) return fail("Aguarde um instante.");
    p.sandboxCooldown = this.time + 0.25;
    if (
      p.state === "dead" ||
      p.hp <= 0 ||
      this.time - p.lastHit < 5 ||
      p.chargeAt !== null ||
      p.training
    )
      return fail("Encerre o combate ou treinamento antes de interagir.");
    if (p.world === "space" || p.ascent || p.altitude > 0.1)
      return fail("Pouse em um planeta para realizar esta ação.");
    if (p.sandboxJob) return fail("Conclua ou cancele a atividade atual.");
    const w = this.sandboxWorld(),
      s = p.sandbox,
      now = Date.now();
    const start = (kind, seconds, extra = {}) => {
      p.sandboxJob = {
        kind,
        started: this.time,
        finish: this.time + seconds,
        x: p.x,
        y: p.y,
        world: p.world,
        ...extra,
      };
      return ok(
        "Atividade iniciada. Mover-se, atacar ou receber dano cancela.",
      );
    };
    if (data.action === 'wear') {
      const item=C.items[data.item];if(!item?.slot||!s.inventory[data.item])return fail('Equipamento indisponível.');
      const old=s.equipment[item.slot];if(!this.sandboxPay(p,{[data.item]:1},old?{[old]:1}:{}))return fail('Sem espaço para a troca.');
      s.equipment[item.slot]=data.item;this.sandboxGear(p);return ok(item.name+' equipado.');
    }
    if(data.action==='unwear'){
      if(!Object.hasOwn(C.slots,data.slot))return fail('Slot inválido.');const item=s.equipment[data.slot];
      if(!item||!this.sandboxPay(p,{}, {[item]:1}))return fail('Mochila cheia ou slot vazio.');s.equipment[data.slot]=null;this.sandboxGear(p);return ok('Equipamento guardado.');
    }
    if (data.action === "path") {
      if (!owns(C.paths, data.path)) return fail("Caminho desconhecido.");
      s.path = data.path;
      return ok("Caminho: " + C.paths[s.path].name);
    }
    if (data.action === "focus") {
      if (!["force", "spirit", "vitality"].includes(data.focus))
        return fail("Foco inválido.");
      s.focus = data.focus;
      return ok("Foco do treino alterado.");
    }
    if (data.action === "gather") {
      const n = this.sandboxObjects(p).find(
        (n) => n.id === data.target && n.type === "resource",
      );
      if (!n || !near(p, n)) return fail("Aproxime-se do recurso.");
      if (!n.ready) return fail("Este recurso está se regenerando.");
      if (count(s.inventory) >= C.capacity) return fail("Mochila cheia.");
      return start("gather", 3, { target: n.id });
    }
    if (data.action === "craft") {
      const r = C.recipes.find((r) => r.id === data.recipe);
      if (!r) return fail("Receita desconhecida.");
      if (C.level(s.practice.craft) < r.skill)
        return fail("Pratique fabricação para desbloquear esta receita.");
      if (
        r.station &&
        !w.structures.some((b) => b.kind === "workbench" && near(p, b, 180))
      )
        return fail("Esta receita exige uma oficina a até 180 m.");
      if (Object.entries(r.cost).some(([k, n]) => s.inventory[k] < n))
        return fail("Materiais insuficientes.");
      return start("craft", 4, { recipe: r.id });
    }
    if (data.action === "build") {
      if (!owns(C.structures, data.kind) || !s.inventory[data.kind])
        return fail("Fabrique a cápsula desta construção primeiro.");
      if (
        w.structures.filter((b) => b.owner === p.citizenId).length >= 8 ||
        w.structures.length >= 1000
      )
        return fail("Limite de construções atingido.");
      const b = {
        x: Math.round((p.x + Math.cos(p.angle) * 105) / 25) * 25,
        y: Math.round((p.y + Math.sin(p.angle) * 105) / 25) * 25,
        world: p.world,
      };
      if (
        !Number.isFinite(b.x) ||
        !Number.isFinite(b.y) ||
        Math.abs(b.x) > 1e7 ||
        Math.abs(b.y) > 1e7
      )
        return fail("Local inválido.");
      if (
        w.structures.some((v) => near(b, v, 150)) ||
        near(b, { ...this.maps[p.world]?.mentor, world: p.world }, 220)
      )
        return fail("Deixe espaço para outras construções e para o mestre.");
      return start("build", 5, { building: data.kind, placement: b });
    }
    if (data.action === "use") {
      if (
        !["medicine", "battery"].includes(data.item) ||
        !s.inventory[data.item]
      )
        return fail("Item indisponível.");
      if (now < s.useAt)
        return fail("Aguarde 20 segundos entre consumíveis.");
      if (
        (data.item === "medicine" && p.hp >= p.maxHp) ||
        (data.item === "battery" && p.ki >= 100)
      )
        return fail("Este recurso já está cheio.");
      s.inventory[data.item]--;
      s.useAt = now + 20000;
      if (data.item === "medicine")
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4);
      else p.ki = Math.min(100, p.ki + 50);
      this.emit("heal", p);
      return ok("Cápsula utilizada.");
    }
    if (data.action === "structure") {
      const b = w.structures.find((b) => b.id === data.target);
      if (!b || !near(p, b, 180)) return fail("Aproxime-se da construção.");
      if (C.structures[b.kind].decor) return ok(C.structures[b.kind].name + " · peça de decoração instalada por " + b.ownerName);
      if (b.kind === "workbench")
        return ok(
          "Oficina disponível: receitas avançadas liberadas enquanto estiver próximo.",
        );
      if (b.readyAt > now) return fail("A construção está recarregando.");
      return start(b.kind, C.structures[b.kind].seconds, { target: b.id });
    }
    if (data.action === "pack") {
      const b = w.structures.find((b) => b.id === data.target);
      if (!b || b.owner !== p.citizenId || !near(p, b, 180))
        return fail(
          "Somente o dono pode recolher a construção, estando próximo.",
        );
      if (b.readyAt > now) return fail("Espere a recarga antes de recolher.");
      if (!this.sandboxPay(p, {}, { [b.kind]: 1 }))
        return fail("Mochila cheia.");
      w.structures = w.structures.filter((v) => v !== b);
      return ok("Construção recolhida em cápsula.");
    }
    if (data.action === "meditate") return start("meditate", 6);
    if (data.action === "survey") return start("survey", 5);
    if (data.action === "contract") {
      const c = C.contracts.find((c) => c.id === data.contract);
      if (!c) return fail("Contrato inválido.");
      if ((s.contracts[c.id] || 0) > now)
        return fail("Contrato disponível novamente após a recarga.");
      if (!near(p, { ...this.maps[p.world].mentor, world: p.world }, 240))
        return fail("Entregue os materiais perto do mestre local.");
      if (!this.sandboxPay(p, c.cost))
        return fail("Faltam materiais para a entrega.");
      s.contracts[c.id] = now + 300000;
      p.zenni += c.zenni;
      this.reward(p, c.xp);
      s.reputation += 5;
      this.sandboxLog(p, "Contrato concluído: " + c.name);
      return ok("Entrega concluída: +" + (c.zenni + Math.ceil(c.xp / 2)) + " zenni.");
    }
    if (data.action === "project") {
      const proj = (w.projects[p.world] ||= {
        level: 0,
        progress: 0,
        contributors: [],
      });
      if (proj.level >= 4)
        return fail("O projeto deste planeta está completo.");
      if (!this.sandboxPay(p, { alloy: 2, crystal: 3 }))
        return fail("A contribuição exige 2 ligas e 3 cristais.");
      proj.progress++;
      if (!proj.contributors.includes(p.citizenId))
        proj.contributors.push(p.citizenId);
      s.reputation += s.path === "guardian" ? 20 : 10;
      this.reward(p, 35);
      if (proj.progress >= 5) {
        proj.level++;
        proj.progress = 0;
      }
      this.sandboxLog(p, "Reconstrução planetária: nível " + proj.level);
      return ok(
        "Contribuição registrada. Infraestrutura planetária: " +
          proj.level +
          "/4.",
      );
    }
    if (data.action === "legacy") {
      if (s.legacy) return fail("Você já recebeu este marco de legado.");
      if (
        s.discoveries.length < 8 ||
        s.reputation < 50 ||
        C.level(s.practice.craft) < 2 ||
        !w.structures.some(
          (b) => b.owner === p.citizenId && b.kind === "beacon",
        )
      )
        return fail(
          "Exige 8 regiões descobertas, 50 reputação, ofício 2 e um farol instalado.",
        );
      s.legacy = 1;
      p.points += 3;
      p.zenni += 300;
      this.sandboxLog(p, "Legado conquistado: Pioneiro do Universo.");
      return ok(
        "Pioneiro do Universo: +3 atributos e +300 zenni. Continue expandindo os planetas.",
      );
    }
    if (data.action === "sell") {
      const qty = data.qty,
        price = data.price;
      if (
        !owns(C.items, data.item) ||
        !Number.isInteger(qty) ||
        qty < 1 ||
        qty > 30 ||
        !Number.isInteger(price) ||
        price < 1 ||
        price > 10000
      )
        return fail("Oferta inválida: 1–30 itens e preço total de 1–10.000.");
      if (
        w.market.length >= 200 ||
        w.market.filter((v) => v.owner === p.citizenId).length >= 8
      )
        return fail("Limite de ofertas atingido.");
      if (!this.sandboxPay(p, { [data.item]: qty }))
        return fail("Itens insuficientes.");
      w.market.push({
        id: randomUUID(),
        owner: p.citizenId,
        seller: p.name,
        item: data.item,
        qty,
        price,
        world: p.world,
      });
      return ok(
        "Oferta publicada. Os itens ficam reservados até venda ou cancelamento.",
      );
    }
    if (data.action === "buy") {
      const offer = w.market.find((v) => v.id === data.target);
      if (!offer || offer.world !== p.world || offer.owner === p.citizenId)
        return fail("Oferta indisponível.");
      if (p.zenni < offer.price) return fail("Zenni insuficiente.");
      if (!this.sandboxPay(p, {}, { [offer.item]: offer.qty }))
        return fail("Mochila cheia.");
      p.zenni -= offer.price;
      w.credits[offer.owner] = (w.credits[offer.owner] || 0) + offer.price;
      w.market = w.market.filter((v) => v !== offer);
      this.sandboxLog(
        p,
        "Compra: " + offer.qty + " " + C.items[offer.item].name,
      );
      return ok("Compra concluída.");
    }
    if (data.action === "cancelSale") {
      const offer = w.market.find((v) => v.id === data.target);
      if (!offer || offer.owner !== p.citizenId)
        return fail("Oferta não pertence a você.");
      if (!this.sandboxPay(p, {}, { [offer.item]: offer.qty }))
        return fail("Abra espaço na mochila.");
      w.market = w.market.filter((v) => v !== offer);
      return ok("Itens devolvidos.");
    }
    if (data.action === "collectSales") {
      const value = w.credits[p.citizenId] || 0;
      p.zenni += value;
      delete w.credits[p.citizenId];
      return ok(value + " zenni recebidos.");
    }
    return fail("Ação desconhecida.");
  };
  Engine.prototype.act = function (id, action) {
    const p = this.players.get(id);
    if (p && action !== "cancelCharge") p.sandboxJob = null;
    return act.call(this, id, action);
  };
  Engine.prototype.sandboxFinish = function (p, j) {
    const s = p.sandbox,
      w = this.sandboxWorld(),
      now = Date.now();
    let message = "Atividade concluída.";
    if (j.kind === "gather") {
      const n = this.sandboxObjects(p).find(
        (v) => v.id === j.target && v.type === "resource",
      );
      if (!n || !near(p, n) || !n.ready) return;
      const qty = 2 + (s.path === "explorer" ? 1 : 0);
      if (!this.sandboxPay(p, {}, { [n.kind]: qty })) return;
      w.depleted[n.id] = now + 45000;
      s.practice.gather += 5;
      message = "Coleta: +" + qty + " " + n.name;
    }
    if (j.kind === "craft") {
      const r = C.recipes.find((v) => v.id === j.recipe);
      if (
        r.station &&
        !w.structures.some((b) => b.kind === "workbench" && near(p, b, 180))
      )
        return;
      if (!this.sandboxPay(p, r.cost, { [r.id]: 1 })) return;
      s.practice.craft += s.path === "artisan" ? 12 : 6;
      message = "Fabricado: " + C.items[r.id].name;
    }
    if (j.kind === "build") {
      if (
        w.structures.some((b) => near(j.placement, b, 150)) ||
        w.structures.length >= 1000 ||
        w.structures.filter((b) => b.owner === p.citizenId).length >= 8 ||
        !this.sandboxPay(p, { [j.building]: 1 })
      )
        return;
      w.structures.push({
        ...j.placement,
        id: randomUUID(),
        kind: j.building,
        owner: p.citizenId,
        ownerName: p.name,
        readyAt: 0,
      });
      message = "Construção instalada: " + C.structures[j.building].name;
    }
    if (["camp", "gravity", "garden", "beacon"].includes(j.kind)) {
      const b = w.structures.find((v) => v.id === j.target);
      if (!b || !near(p, b, 180) || b.readyAt > now) return;
      if (j.kind === "camp") {
        p.hp = Math.min(
          p.maxHp,
          p.hp + p.maxHp * (0.3 + (w.projects[p.world]?.level || 0) * 0.05),
        );
        p.ki = Math.min(100, p.ki + 30);
        b.readyAt = now + 30000;
        message = "Descanso: vida e ki recuperados.";
      }
      if (j.kind === "garden") {
        if (!this.sandboxPay(p, {}, { herb: 5 })) return;
        b.readyAt = now + 90000;
        s.practice.gather += 5;
        message = "Viveiro: +5 ervas.";
      }
      if (j.kind === "gravity") {
        if (p.ki < 25) return;
        p.ki -= 25;
        const before = C.level(s.practice.focus);
        s.practice.focus += 12;
        if (C.level(s.practice.focus) > before) {
          p.stats[s.focus]++;
          if (s.focus === "vitality") {
            p.maxHp += 18;
            p.hp += 18;
          }
        }
        b.readyAt = now + 30000;
        message = "Treino gravitacional: +12 prática de " + s.focus;
      }
    }
    if (j.kind === "meditate") {
      p.ki = Math.min(100, p.ki + 20);
      const before = C.level(s.practice.focus);
      s.practice.focus += 3;
      if (C.level(s.practice.focus) > before) {
        p.stats[s.focus]++;
        if (s.focus === "vitality") {
          p.maxHp += 18;
          p.hp += 18;
        }
      }
      message = "Meditação: +3 prática; +20 ki.";
    }
    if (j.kind === "survey" || j.kind === "beacon") {
      const key =
        p.world + ":" + Math.floor(p.x / 600) + ":" + Math.floor(p.y / 600);
      if (!s.discoveries.includes(key) && s.discoveries.length < 500) {
        s.discoveries.push(key);
        this.reward(p, 20);
        s.reputation += 2;
        message = "Região descoberta: +20 XP; +2 reputação.";
      } else message = "Região já cartografada.";
      if (j.kind === "beacon") {
        p.ki = Math.min(100, p.ki + 40);
        const b = w.structures.find((v) => v.id === j.target);
        b.readyAt = now + 60000;
        message += " Farol: +40 ki.";
      }
    }
    this.sandboxLog(p, message);
    this.emit("sandbox", p, { label: message });
  };
  Engine.prototype.tick = function (dt = 1 / 30) {
    tick.call(this, dt);
    for (const p of this.players.values()) {
      const j = p.sandboxJob;
      if (!j) continue;
      if (
        !near(p, j, 18) ||
        p.state === "dead" ||
        p.ascent ||
        p.altitude > 0.1 ||
        this.time - p.lastHit < 5 ||
        Math.hypot(p.input.x || 0, p.input.y || 0) > 0.1 ||
        p.input.guard ||
        p.input.charge
      ) {
        p.sandboxJob = null;
        this.sandboxLog(p, "Atividade interrompida por movimento ou combate.");
        continue;
      }
      if (this.time >= j.finish) {
        p.sandboxJob = null;
        this.sandboxFinish(p, j);
      }
    }
    if (this.time > (this.sandboxCleanupAt || 0)) {
      this.sandboxCleanupAt = this.time + 30;
      const w = this.sandboxWorld(),
        now = Date.now();
      for (const [k, v] of Object.entries(w.depleted))
        if (v <= now) delete w.depleted[k];
    }
  };
  Engine.prototype.snapshot = function (id) {
    const out = snapshot.call(this, id),
      p = this.players.get(id);
    if (!out || !p) return out;
    const w = this.sandboxWorld();
    out.self.appearance=p.appearance;out.self.background=p.background;
    for(const player of out.players){const actual=this.players.get(player.id);if(actual)player.appearance=actual.appearance;}
    out.self.sandbox = structuredClone(p.sandbox);
    out.self.sandbox.inventory=Object.fromEntries(Object.entries(p.sandbox.inventory).filter(([,n])=>n>0));
    out.self.sandboxJob = p.sandboxJob
      ? {
          ...p.sandboxJob,
          progress: Math.min(
            1,
            (this.time - p.sandboxJob.started) /
              (p.sandboxJob.finish - p.sandboxJob.started),
          ),
        }
      : null;
    out.sandbox = {
      objects: this.sandboxObjects(p),
      market: w.market
        .filter((o) => o.world === p.world || o.owner === p.citizenId)
        .map((o) => ({
          ...o,
          owned: o.owner === p.citizenId,
          owner: undefined,
        })),
      credits: w.credits[p.citizenId] || 0,
      project: w.projects[p.world]
        ? {
            level: w.projects[p.world].level,
            progress: w.projects[p.world].progress,
          }
        : { level: 0, progress: 0 },
      structures: w.structures
        .filter((b) => b.owner === p.citizenId)
        .map((b) => ({
          id: b.id,
          kind: b.kind,
          world: b.world,
          x: b.x,
          y: b.y,
        })),
      now: Date.now(),
    };
    for (const o of out.sandbox.objects) delete o.owner;
    return out;
  };
};
