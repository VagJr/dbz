"use strict";
const B = require("../shared/beta"),
  T = require("./enemy-tactics");
const clean = (data) => ({
  version: 1,
  claimed: [
    ...new Set(
      Array.isArray(data?.claimed)
        ? data.claimed.filter((id) => B.cosmetics.some((c) => c.id === id))
        : [],
    ),
  ],
  equipped: Object.fromEntries(
    ["trail", "frame"].map((slot) => [
      slot,
      B.cosmetics.some(
        (c) => c.id === data?.equipped?.[slot] && c.slot === slot,
      )
        ? data.equipped[slot]
        : null,
    ]),
  ),
  completed: Math.min(
    10000,
    Math.max(0, Math.floor(Number(data?.completed) || 0)),
  ),
  nextExpedition: Math.max(
    0,
    Math.min(1e14, Number(data?.nextExpedition) || 0),
  ),
  blocked: Array.isArray(data?.blocked)
    ? data.blocked
        .filter((x) => typeof x === "string" && /^[a-f0-9-]{36}$/.test(x))
        .slice(-100)
    : [],
});
module.exports = (Engine) => {
  const add = Engine.prototype.addPlayer,
    profile = Engine.prototype.profile,
    snapshot = Engine.prototype.snapshot,
    tick = Engine.prototype.tick,
    damage = Engine.prototype.damage;
  Engine.prototype.addPlayer = function (id, data = {}) {
    const p = add.call(this, id, data);
    p.beta = clean(data.beta);
    for (const slot of ["trail", "frame"])
      if (!p.beta.claimed.includes(p.beta.equipped[slot]))
        p.beta.equipped[slot] = null;
    p.combatRecord = { damage: 0, received: 0, parries: 0, defeated: 0 };
    return p;
  };
  Engine.prototype.profile = function (p) {
    return { ...profile.call(this, p), beta: clean(p.beta) };
  };
  Engine.prototype.betaProgress = function (p) {
    return {
      explore: p.sandbox?.discoveries.length || 0,
      craft: p.sandbox?.practice.craft || 0,
      story: p.storyState?.completedQuests.length || 0,
      challenge: p.beta.completed,
    };
  };
  Engine.prototype.betaCommand = function (id, data) {
    const p = this.players.get(id);
    if (!p || !data || typeof data !== "object")
      return { ok: false, message: "Ação inválida." };
    const bad = (message) => ({ ok: false, message });
    if (data.action === "sparringEnd") {
      for (const e of this.enemies) if (e.practiceOwner === id) e.dead = true;
      p.sparring = null;
      return { ok: true, message: "Treino encerrado." };
    }
    if (data.action === "sparring") {
      const ai = T.ROLES[data.role],
        mentor = this.maps[p.world]?.mentor,
        rank = ["regular", "veteran", "elite"].includes(data.rank)
          ? data.rank
          : "regular";
      if (
        !ai ||
        !mentor ||
        p.world === "space" ||
        p.mode !== "ground" ||
        Math.hypot(p.x - mentor.x, p.y - mentor.y) > 280
      )
        return bad("Pouse junto ao mestre do planeta para iniciar o treino.");
      if (
        p.state === "dead" ||
        p.hp < 2 ||
        p.training ||
        p.expedition ||
        ((p.lastHit || 0) > 0 && this.time - p.lastHit < 5)
      )
        return bad("Recupere-se e encerre a atividade atual primeiro.");
      if (
        this.enemies.some(
          (e) =>
            !e.dead &&
            !e.practiceOwner &&
            e.world === p.world &&
            Math.hypot(e.x - p.x, e.y - p.y) < 650,
        )
      )
        return bad("Afaste ameaças reais antes de treinar.");
      for (const e of this.enemies) if (e.practiceOwner === id) e.dead = true;
      const skin = {
        scout: "soldier",
        brawler: "demon",
        duelist: "vegeta",
        skirmisher: "android",
        artillery: "frieza",
        juggernaut: "jiren",
      }[data.role];
      const e = this.spawn(
        p.world,
        "Sparring · " + data.role,
        skin,
        p.x + 240,
        p.y,
        false,
        {
          hp: 500,
          maxHp: 500,
          damage: rank === "elite" ? 18 : rank === "veteran" ? 12 : 7,
          rank,
          level: 1,
          ai: { ...ai, aggroRange: 800 },
          practiceOwner: id,
          nonRespawn: true,
          rewardXP: 0,
          cooldown: this.time + 2,
        },
      );
      p.sparring = {
        enemyId: e.id,
        ends: this.time + 180,
        world: p.world,
        x: p.x,
        y: p.y,
      };
      p.targetId = e.id;
      return {
        ok: true,
        message:
          "Treino de três minutos. Não concede XP ou itens; o rival interrompe antes de nocautear você.",
      };
    }
    if (data.action === "claim") {
      const c = B.cosmetics.find((c) => c.id === data.item);
      if (!c) return bad("Cosmético desconhecido.");
      if (p.beta.claimed.includes(c.id))
        return bad("Este visual já pertence a você.");
      if (this.betaProgress(p)[c.need] < c.count) return bad(c.text);
      p.beta.claimed.push(c.id);
      return {
        ok: true,
        message: "Visual desbloqueado. Não altera atributos.",
      };
    }
    if (data.action === "style") {
      const c = B.cosmetics.find((c) => c.id === data.item);
      if (data.item === null && ["trail", "frame"].includes(data.slot)) {
        p.beta.equipped[data.slot] = null;
        return { ok: true, message: "Visual removido." };
      }
      if (!c || !p.beta.claimed.includes(c.id))
        return bad("Desbloqueie esse visual primeiro.");
      p.beta.equipped[c.slot] = c.id;
      return { ok: true, message: "Visual aplicado." };
    }
    if (data.action === "expedition") {
      const def = B.expeditions.find((e) => e.id === data.id);
      if (!def) return bad("Expedição desconhecida.");
      if (p.state === "dead" || p.expedition)
        return bad("Conclua o confronto atual.");
      if (p.level < def.minLevel)
        return bad("Requer nível " + def.minLevel + ".");
      if (Date.now() < p.beta.nextExpedition)
        return bad("Aguarde a recuperação da expedição.");
      if (p.world !== def.world || Math.hypot(p.x - def.x, p.y - def.y) > 280)
        return bad("Viaje até o ponto marcado para iniciar.");
      p.expedition = {
        id: def.id,
        wave: 0,
        ends: this.time + 300,
        serial: ++this.serial,
      };
      this.expeditionWave(p, def);
      return {
        ok: true,
        message: "Expedição iniciada. Permaneça na área e supere duas ondas.",
      };
    }
    return bad("Ação desconhecida.");
  };
  Engine.prototype.expeditionWave = function (p, def) {
    const run = p.expedition;
    run.wave++;
    for (let i = 0; i < (run.wave === 1 ? 3 : 2); i++) {
      const role =
          i === 0 && run.wave === 2
            ? "juggernaut"
            : run.wave === 2
              ? "artillery"
              : def.role,
        ai = { ...T.ROLES[role], aggroRange: 750, reactionDelay: 0.28 };
      const hp = 140 + def.minLevel * 20 + (run.wave === 2 ? 100 : 0);
      this.spawn(
        def.world,
        run.wave === 2 && i === 0
          ? "Comandante da expedição"
          : "Vanguarda · " + run.wave,
        def.skin,
        def.x + (i - 1) * 170,
        def.y - 220,
        false,
        {
          hp,
          maxHp: hp,
          level: def.minLevel,
          damage: 15 + def.minLevel,
          ai,
          rank: "veteran",
          rewardXP: 0,
          expeditionOwner: p.id,
          expeditionSerial: run.serial,
          nonRespawn: true,
          cooldown: this.time + 1.5,
        },
      );
    }
  };
  Engine.prototype.tick = function (dt) {
    tick.call(this, dt);
    for (const p of this.players.values())
      if (p.sparring) {
        const run = p.sparring,
          e = this.enemies.find((e) => e.id === run.enemyId);
        if (
          !e ||
          e.dead ||
          p.hp <= 1 ||
          p.world !== run.world ||
          Math.hypot(p.x - run.x, p.y - run.y) > 700 ||
          this.time >= run.ends
        ) {
          if (e) e.dead = true;
          p.sparring = null;
          this.emit("notice", p, {
            text: "Treino encerrado. Observe seu ritmo e tente outra identidade.",
            playerId: p.id,
          });
        }
      }
    this.enemies = this.enemies.filter(
      (e) => !e.practiceOwner || (!e.dead && this.players.has(e.practiceOwner)),
    );
    for (const p of this.players.values()) {
      const run = p.expedition;
      if (!run) continue;
      const def = B.expeditions.find((d) => d.id === run.id),
        active = this.enemies.filter(
          (e) =>
            e.expeditionOwner === p.id &&
            e.expeditionSerial === run.serial &&
            !e.dead,
        );
      if (
        p.state === "dead" ||
        p.world !== def.world ||
        Math.hypot(p.x - def.x, p.y - def.y) > 1400 ||
        this.time > run.ends
      ) {
        for (const e of active) e.dead = true;
        p.expedition = null;
        p.beta.nextExpedition = Date.now() + 60000;
        this.emit("orb", p, {
          text: "Expedição encerrada. Reorganize-se e tente novamente.",
          playerId: p.id,
        });
        continue;
      }
      if (!active.length) {
        if (run.wave < 2) this.expeditionWave(p, def);
        else {
          p.beta.completed++;
          p.beta.nextExpedition = Date.now() + 600000;
          p.expedition = null;
          this.reward(p, 150 + def.minLevel * 10);
          this.emit("complete", p, {
            text: "EXPEDIÇÃO CONCLUÍDA · um novo visual espera por você.",
            playerId: p.id,
          });
        }
      }
    }
    this.enemies = this.enemies.filter(
      (e) =>
        !e.expeditionOwner || (!e.dead && this.players.has(e.expeditionOwner)),
    );
  };
  Engine.prototype.damage = function (a, b, amount, heavy) {
    const hp = b.hp;
    damage.call(this, a, b, amount, heavy);
    const dealt = Math.max(0, hp - b.hp);
    if (a.combatRecord) {
      a.combatRecord.damage += Math.round(dealt);
      if (hp > 0 && b.dead) a.combatRecord.defeated++;
    }
    if (b.combatRecord) {
      b.combatRecord.received += Math.round(dealt);
      if (!dealt && b.counterUntil > this.time) b.combatRecord.parries++;
    }
  };
  Engine.prototype.snapshot = function (id) {
    const s = snapshot.call(this, id);
    if (!s) return s;
    const p = this.players.get(id);
    s.beta = {
      sparring: p.sparring
        ? {
            enemyId: p.sparring.enemyId,
            seconds: Math.max(0, Math.ceil(p.sparring.ends - this.time)),
          }
        : null,
      version: B.version,
      progress: this.betaProgress(p),
      claimed: p.beta.claimed,
      equipped: p.beta.equipped,
      completed: p.beta.completed,
      nextExpedition: p.beta.nextExpedition,
      expedition: p.expedition
        ? {
            id: p.expedition.id,
            wave: p.expedition.wave,
            seconds: Math.max(0, Math.ceil(p.expedition.ends - this.time)),
          }
        : null,
      combat: p.combatRecord,
    };
    s.self.cosmetics = p.beta.equipped;
    for (const q of s.players)
      q.cosmetics = this.players.get(q.id)?.beta?.equipped || {};
    return s;
  };
};
