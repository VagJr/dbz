"use strict";
const C = require("../shared/combat");
const ready = (p, t) =>
  p &&
  !p.duelId &&
  !p.sandboxJob &&
  !p.training &&
  !p.sparring &&
  !p.expedition &&
  !p.moveAction &&
  p.state !== "dead" &&
  p.mode === "ground" &&
  t - Math.max(p.lastHit ?? -99, p.lastCombatAt ?? -99) > 5;
const savedKeys = [
  "x",
  "y",
  "world",
  "hp",
  "maxHp",
  "ki",
  "pvp",
  "mode",
  "form",
  "level",
  "stats",
  "equipped",
  "kaiokenUntil",
];
module.exports = (Engine) => {
  const beta = Engine.prototype.betaCommand,
    tick = Engine.prototype.tick,
    damage = Engine.prototype.damage,
    profile = Engine.prototype.profile,
    snapshot = Engine.prototype.snapshot,
    act = Engine.prototype.act;
  Engine.prototype.duelBegin = function (a, b) {
    this.duels ??= new Map();
    const id = "duel-" + ++this.serial,
      m = {
        id,
        players: [a.id, b.id],
        score: [0, 0],
        round: 1,
        world: a.world,
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        start: this.time + 3,
        ends: this.time + 3 + C.roundSeconds,
        events: [],
        samples: [],
        nextSample: 0,
      };
    this.duels.set(id, m);
    for (const p of [a, b]) {
      p.duelRestore = Object.fromEntries(savedKeys.map((k) => [k, p[k]]));
      p.duelId = id;
      p.sandboxJob = null;
      p.pvp = true;
      p.maxHp = C.duelHP;
      p.hp = C.duelHP;
      p.ki = 100;
      p.form = false;
      p.kaiokenUntil = 0;
      p.mode = "ground";
      p.invuln = 0;
      p.targetId = p === a ? b.id : a.id;
    }
    this.duelReset(m);
    return m;
  };
  Engine.prototype.duelReset = function (m) {
    for (const c of [...(this.clashes?.values() || [])])
      if (c.duelId === m.id) this.endClash(c, true);
    m.start = this.time + 3;
    m.ends = m.start + C.roundSeconds;
    for (const [id, i] of m.players.map((id, i) => [id, i])) {
      const p = this.players.get(id);
      if (!p) continue;
      p.hp = C.duelHP;
      p.ki = 100;
      p.x = m.x + (i ? -180 : 180);
      p.y = m.y;
      p.angle = i ? 0 : Math.PI;
      p.vx = p.vy = 0;
      p.stun = 0;
      p.invuln = 0;
      p.juggleCount = 0;
      p.juggleAt = -99;
      p.juggleSource = null;
      p.counterUntil = 0;
      p.guardAt = -99;
      p.guardPressedAt = -99;
      p.nextPerfectGuard = 0;
      p.inputAt = this.time;
      p.until = 0;
      p.queuedAttack = null;
      p.launch = null;
      p.moveAction = null;
      p.rhythmQueue = null;
      p.chargeAt = null;
      p.meleeAt = null;
      p.comboConfirmed = 0;
      p.cooldowns = { attack: 0, blast: 0, dash: 0, form: 0 };
      p.state = "idle";
      p.roundLocked = true;
      p.input = { x: 0, y: 0, angle: p.angle };
    }
    this.shots = this.shots.filter((s) => !m.players.includes(s.owner));
  };
  Engine.prototype.duelEnd = function (m, winner, reason) {
    for (const c of [...(this.clashes?.values() || [])])
      if (c.duelId === m.id) this.endClash(c, true);
    const result = {
      id: m.id,
      winner,
      reason,
      score: m.score,
      rounds: m.round,
      endedAt: this.time,
    };
    this.duelRecords ??= [];
    this.duelRecords.push({ ...result, events: m.events, samples: m.samples });
    if (this.duelRecords.length > 20) this.duelRecords.shift();
    for (const id of m.players) {
      const p = this.players.get(id);
      if (!p) continue;
      Object.assign(p, p.duelRestore);
      delete p.duelRestore;
      p.duelId = null;
      p.roundLocked = false;
      p.moveAction = null;
      p.rhythmQueue = null;
      p.stun = 0;
      p.launch = null;
      p.vx = p.vy = 0;
      p.state = "idle";
      p.counterUntil = 0;
      p.chargeAt = null;
      p.meleeAt = null;
      p.queuedAttack = null;
      p.invuln = 0;
      p.until = 0;
      p.input = { x: 0, y: 0, angle: p.angle };
      p.targetId = null;
      p.lastHit = this.time;
      p.lastCombatAt = this.time;
      p.duelResult = result;
      this.emit("notice", p, {
        playerId: id,
        text: reason + " · " + m.score.join(" × "),
      });
    }
    this.shots = this.shots.filter(
      (s) => m.players.includes(s.owner) === false,
    );
    this.duels.delete(m.id);
  };
  Engine.prototype.duelRound = function (m, winner, reason) {
    if (winner) m.score[m.players.indexOf(winner)]++;
    m.events.push({
      at: this.time,
      type: "round",
      winner,
      reason,
      score: [...m.score],
    });
    if (m.score.some((v) => v >= 2) || m.round >= 3) {
      const win =
        m.score[0] === m.score[1]
          ? null
          : m.players[m.score[0] > m.score[1] ? 0 : 1];
      this.duelEnd(m, win, win ? "Duelo concluído" : "Duelo empatado");
    } else {
      m.round++;
      this.duelReset(m);
    }
  };
  Engine.prototype.betaCommand = function (id, data) {
    const p = this.players.get(id);
    if (!p) return beta.call(this, id, data);
    const bad = (message) => ({ ok: false, message });
    if (data?.action === "duelInvite") {
      const q = this.players.get(data.target);
      if (
        !ready(p, this.time) ||
        !ready(q, this.time) ||
        q === p ||
        q.world !== p.world ||
        Math.hypot(q.x - p.x, q.y - p.y) > 500 ||
        p.duelId ||
        q.duelId ||
        p.sparring ||
        q.sparring ||
        p.expedition ||
        q.expedition ||
        p.state === "dead" ||
        q.state === "dead" ||
        p.mode !== "ground" ||
        q.mode !== "ground" ||
        this.time - Math.max(p.lastHit, q.lastHit) < 5
      )
        return bad("Encontre um rival próximo, pousado e fora de combate.");
      if (
        this.enemies.some(
          (e) =>
            !e.dead &&
            e.world === p.world &&
            Math.hypot(e.x - p.x, e.y - p.y) < 800,
        )
      )
        return bad("Escolha um local sem inimigos por perto.");
      if ((p.nextDuelInvite || 0) > this.time)
        return bad("Aguarde antes de convidar novamente.");
      p.nextDuelInvite = this.time + 10;
      q.duelInvite = { from: id, name: p.name, expires: this.time + 30 };
      return {
        ok: true,
        message: "Convite enviado. O rival precisa aceitar na Central → Dojo.",
      };
    }
    if (data?.action === "duelDecline") {
      p.duelInvite = null;
      return { ok: true, message: "Convite recusado." };
    }
    if (data?.action === "duelAccept") {
      const invite = p.duelInvite,
        q = invite && this.players.get(invite.from);
      p.duelInvite = null;
      if (
        !ready(p, this.time) ||
        !ready(q, this.time) ||
        invite.expires < this.time ||
        q.duelId ||
        p.duelId ||
        p.sparring ||
        q.sparring ||
        p.expedition ||
        q.expedition ||
        p.world !== q.world ||
        p.mode !== "ground" ||
        q.mode !== "ground" ||
        p.state === "dead" ||
        q.state === "dead" ||
        this.time - Math.max(p.lastHit, q.lastHit) < 5 ||
        Math.hypot(p.x - q.x, p.y - q.y) > 500
      )
        return bad("O convite expirou ou as condições mudaram.");
      if (
        this.enemies.some(
          (e) =>
            !e.dead &&
            e.world === p.world &&
            Math.min(
              Math.hypot(e.x - p.x, e.y - p.y),
              Math.hypot(e.x - q.x, e.y - q.y),
            ) < 800,
        )
      )
        return bad("Há inimigos próximos. Procurem um local seguro.");
      this.duelBegin(q, p);
      return {
        ok: true,
        message: "Duelo aceito. Vida e dano equalizados; prepare-se.",
      };
    }
    if (data?.action === "duelForfeit") {
      const m = this.duels?.get(p.duelId);
      if (!m) return bad("Nenhum duelo ativo.");
      this.duelEnd(
        m,
        m.players.find((q) => q !== id),
        "Desistência",
      );
      return { ok: true, message: "Duelo encerrado." };
    }
    if (p.duelId)
      return bad("Conclua o duelo antes de usar sistemas do mundo.");
    return beta.call(this, id, data);
  };
  Engine.prototype.act = function (id, name) {
    const p = this.players.get(id);
    if (p?.duelId && ["form", "kaioken", "flight", "orbit"].includes(name))
      return false;
    return act.call(this, id, name);
  };
  for (const name of [
    "sandboxCommand",
    "travel",
    "orbit",
    "train",
    "learn",
    "attribute",
    "equip",
    "campaign",
    "interact",
  ]) {
    const original = Engine.prototype[name];
    if (!original) continue;
    Engine.prototype[name] = function (id, ...args) {
      if (this.players.get(id)?.duelId)
        return name === "sandboxCommand"
          ? { ok: false, message: "Conclua o duelo primeiro." }
          : false;
      return original.call(this, id, ...args);
    };
  }
  Engine.prototype.profile = function (p) {
    return profile.call(this, p.duelRestore ? { ...p, ...p.duelRestore } : p);
  };
  Engine.prototype.damage = function (a, b, amount, heavy) {
    if (a.duelId && a.duelId === b.duelId) {
      const m = this.duels.get(a.duelId);
      if (!m || this.time < m.start) return;
      const hp = b.hp;
      damage.call(this, a, b, amount, heavy);
      if (b.hp < hp) {
        m.events.push({
          at: this.time,
          type: "hit",
          source: a.id,
          target: b.id,
          damage: Math.round(hp - b.hp),
          hp: b.hp,
        });
        if (m.events.length > 2000) m.events.shift();
      }
      return;
    }
    return damage.call(this, a, b, amount, heavy);
  };
  Engine.prototype.tick = function (dt = 1 / 30) {
    for (const m of this.duels?.values() || []) {
      const members = m.players.map((id) => this.players.get(id));
      if (members.some((p) => !p)) {
        this.duelEnd(m, members.find(Boolean)?.id || null, "Desconexão");
        continue;
      }
      for (const p of members) p.roundLocked = this.time < m.start;
    }
    tick.call(this, dt);
    for (const m of this.duels?.values() || []) {
      const players = m.players.map((id) => this.players.get(id));
      if (this.time >= m.nextSample) {
        m.nextSample = this.time + 0.2;
        m.samples.push({
          t: this.time,
          p: players.map((p) => ({
            id: p.id,
            x: p.x,
            y: p.y,
            hp: p.hp,
            ki: p.ki,
            state: p.state,
          })),
        });
        if (m.samples.length > 3000) m.samples.shift();
      }
      if (players.some((p) => p.hp <= 0)) {
        const survivors = players.filter((p) => p.hp > 0);
        this.duelRound(
          m,
          survivors.length === 1 ? survivors[0].id : null,
          survivors.length ? "Nocaute" : "Nocaute simultâneo",
        );
        continue;
      }
      const out = players.find(
        (p) => p.world !== m.world || Math.hypot(p.x - m.x, p.y - m.y) > 750,
      );
      if (out) {
        this.duelEnd(
          m,
          m.players.find((id) => id !== out.id),
          "Saída da arena",
        );
        continue;
      }
      if (this.time >= m.ends) {
        const [a, b] = players;
        this.duelRound(
          m,
          a.hp === b.hp ? null : a.hp > b.hp ? a.id : b.id,
          "Tempo encerrado",
        );
      }
    }
  };
  Engine.prototype.snapshot = function (id) {
    const s = snapshot.call(this, id);
    if (!s) return s;
    const p = this.players.get(id),
      m = this.duels?.get(p.duelId);
    s.self.duel = m
      ? {
          id: m.id,
          round: m.round,
          score: m.score,
          players: m.players,
          countdown: Math.max(0, m.start - this.time),
          seconds: Math.max(0, Math.ceil(m.ends - this.time)),
          x: m.x,
          y: m.y,
          radius: 750,
        }
      : null;
    s.self.duelInvite = p.duelInvite?.expires > this.time ? p.duelInvite : null;
    s.self.duelResult = p.duelResult || null;
    return s;
  };
};
