"use strict";
const Motor = require("./enemy-motor");
const delta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
module.exports = (Engine) => {
  const act = Engine.prototype.act,
    input = Engine.prototype.input,
    tick = Engine.prototype.tick,
    damage = Engine.prototype.damage,
    snapshot = Engine.prototype.snapshot;
  Engine.prototype.fighterById = function (id) {
    return (
      this.players.get(id) || this.enemies.find((e) => e.id === id && !e.dead)
    );
  };
  Engine.prototype.canContest = function (a, b) {
    if (
      !a ||
      !b ||
      a.id === b.id ||
      a.dead ||
      b.dead ||
      a.state === "dead" ||
      b.state === "dead" ||
      a.world !== b.world ||
      a.roundLocked ||
      b.roundLocked
    )
      return false;
    if (a.duelId || b.duelId) return !!a.duelId && a.duelId === b.duelId;
    if (
      (a.practiceOwner && a.practiceOwner !== b.id) ||
      (b.practiceOwner && b.practiceOwner !== a.id)
    )
      return false;
    const ap = this.players.has(a.id),
      bp = this.players.has(b.id);
    return ap && bp ? !!(a.pvp && b.pvp) : ap !== bp;
  };
  Engine.prototype.repel = function (a, b, power = 650) {
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    b.moveAction = null;
    b.rhythmQueue = null;
    b.chargeAt = b.meleeAt = null;
    b.queuedAttack = null;
    b.vx = b.vy = 0;
    b.stun = Math.max(b.stun || 0, this.time + 0.2);
    b.launch = {
      x: Math.cos(angle) * power,
      y: Math.sin(angle) * power,
      left: 0.26,
      tier: "low",
    };
    b.state = "stun";
    b.pressureUntil = 0;
    b.attackAt = Infinity;
    b.guardUntil = 0;
    b.recoveryUntil = this.time + 0.25;
    b.cooldown = b.nextOpening = this.time + 0.3;
  };
  Engine.prototype.dualImpact = function (a, b) {
    const center = { world: a.world, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.repel(center, a, 850);
    this.repel(center, b, 850);
    a.bodyImpactAt = b.bodyImpactAt = this.time;
    this.emit("collisionBurst", center, {
      radius: 180,
      text: "IMPACTO",
      heavy: true,
    });
  };
  Engine.prototype.startClash = function (a, b, type, point, shots) {
    if (
      !this.canContest(a, b) ||
      a.clashId ||
      b.clashId ||
      a.clashCooldown > this.time ||
      b.clashCooldown > this.time ||
      !this.clearSight(a, b)
    )
      return false;
    this.clashes ??= new Map();
    const c = {
      id: "clash" + ++this.serial,
      type,
      world: a.world,
      x: point.x,
      y: point.y,
      ids: [a.id, b.id],
      start: this.time,
      ends: this.time + (type === "beam" ? 2.4 : 1.8),
      period: type === "beam" ? 0.3 : 0.3,
      scores: [0, 0],
      beats: [-1, -1],
      shots,
      duelId: a.duelId || null,
    };
    this.clashes.set(c.id, c);
    for (const e of [a, b]) {
      e.clashId = c.id;
      e.clashCooldown = this.time + 10;
      e.moveAction = null;
      e.rhythmQueue = null;
      e.launch = null;
      e.chargeAt = e.meleeAt = null;
      e.vx = e.vy = 0;
      e.state = "clash";
      e.stun = 0;
      e.lastCombatAt = this.time;
      e.guardUntil = 0;
      e.pressureUntil = 0;
    }
    this.emit("collisionBurst", point, {
      radius: type === "beam" ? 150 : 100,
      text: type === "beam" ? "DISPUTA DE KI" : "TROCAÇÃO",
      heavy: true,
    });
    return true;
  };
  Engine.prototype.clashPulse = function (e, action) {
    const c = this.clashes?.get(e.clashId);
    if (!c || this.time >= c.ends) return false;
    const i = c.ids.indexOf(e.id),
      elapsed = this.time - c.start,
      beat = Math.floor(elapsed / c.period);
    if (i < 0 || c.beats[i] === beat) return false;
    c.beats[i] = beat;
    const expected = c.type === "beam" ? "ki" : beat % 2 ? "guard" : "attack";
    const resource = this.players.has(e.id) ? "ki" : "effort",
      cost = c.type === "beam" ? 3 : 1;
    if ((e[resource] || 0) < cost) return false;
    e[resource] -= cost;
    if (action !== expected) return false;
    const precision =
      1 - Math.min(1, Math.abs(elapsed / c.period - beat - 0.5) * 2);
    c.scores[i] += 0.4 + 0.6 * precision;
    this.emit("clashPulse", e, {
      radius: c.type === "beam" ? 50 : 35,
      combo: (beat % 2) + 1,
    });
    return true;
  };
  Engine.prototype.endClash = function (c, cancel = false) {
    if (!c || !this.clashes?.has(c.id)) return;
    this.clashes.delete(c.id);
    const pair = c.ids.map((id) => this.fighterById(id));
    for (const e of pair)
      if (e && e.clashId === c.id) {
        e.clashId = null;
        e.state = e.hp > 0 ? "idle" : "dead";
        e.input && (e.input = { x: 0, y: 0, angle: e.angle });
        e.stun = this.time + 0.12;
        e.recoveryUntil = this.time + 0.12;
        e.cooldown = e.nextOpening = this.time + 0.2;
        e.attackAt = Infinity;
        e.confirmedHits = 0;
        e.pressureUntil = 0;
      }
    if (cancel || !pair.every(Boolean) || !this.canContest(...pair)) return;
    const diff = c.scores[0] - c.scores[1];
    if (Math.abs(diff) < 0.65) {
      this.dualImpact(...pair);
      this.emit("notice", c, { text: "DISPUTA EMPATADA" });
      return;
    }
    const wi = diff > 0 ? 0 : 1,
      winner = pair[wi],
      loser = pair[1 - wi];
    if (c.type === "beam") {
      const original = c.shots[wi],
        angle = Math.atan2(loser.y - c.y, loser.x - c.x);
      this.shots.push({
        ...original,
        id: "s" + ++this.serial,
        owner: winner.id,
        hostile: !this.players.has(winner.id),
        world: c.world,
        x: c.x,
        y: c.y,
        originX: c.x,
        originY: c.y,
        angle,
        initialAngle: angle,
        trail: [],
        steerUntil: 0,
        charged: false,
        clashResolved: true,
        speed: 900,
        life: Math.min(1.5, distance(c, loser) / 900 + 0.3),
        damage: original.damage * 0.8,
        hits: [],
      });
    } else {
      winner.attackData = { posture: 20, stun: 0.25 };
      this.damage(winner, loser, 24);
      winner.attackData = null;
      this.repel(winner, loser, 650);
    }
    this.emit("collisionBurst", c, {
      radius: 170,
      text: "VANTAGEM · " + winner.name,
      heavy: true,
    });
  };
  Engine.prototype.tryMeleeClash = function (group) {
    const candidates = group.filter(
      (i) => i.melee && !i.source.clashId && i.source.stun <= this.time,
    );
    for (let i = 0; i < candidates.length; i++)
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i].source,
          b = candidates[j].source;
        if (
          !this.canContest(a, b) ||
          distance(a, b) > 140 ||
          Math.cos(Math.atan2(b.y - a.y, b.x - a.x) - a.angle) < 0.5 ||
          Math.cos(Math.atan2(a.y - b.y, a.x - b.x) - b.angle) < 0.5
        )
          continue;
        a.clashEngagement = (a.clashEngagement || 0) + 1;
        b.clashEngagement = (b.clashEngagement || 0) + 1;
        if (Math.min(a.clashEngagement, b.clashEngagement) < 3) continue;
        if (
          this.startClash(a, b, "fists", {
            world: a.world,
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
          })
        )
          a.clashEngagement = b.clashEngagement = 0;
      }
    return group.filter((i) => !i.source.clashId);
  };
  Engine.prototype.advanceBeams = function (dt) {
    const beams = this.shots.filter((s) => s.charged && s.life > 0);
    for (const s of beams) {
      const owner = this.fighterById(s.owner);
      if (!owner) continue;
      s.initialAngle ??= s.angle;
      s.trail ??= [];
      if (this.time < s.steerUntil && !owner.clashId) {
        const aim = this.players.has(owner.id)
          ? owner.input.angle
          : owner.angle;
        const goal =
          s.initialAngle + clamp(delta(aim, s.initialAngle), -0.65, 0.65);
        s.angle += clamp(delta(goal, s.angle), -1.2 * dt, 1.2 * dt);
      }
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 18) s.trail.shift();
    }
    // Swept relative segments prevent two fast beams crossing between server ticks.
    for (let i = 0; i < beams.length; i++)
      for (let j = i + 1; j < beams.length; j++) {
        const a = beams[i],
          b = beams[j];
        if (
          a.life <= 0 ||
          b.life <= 0 ||
          a.world !== b.world ||
          Math.cos(a.angle - b.angle) > -0.25
        )
          continue;
        const ap = this.fighterById(a.owner),
          bp = this.fighterById(b.owner);
        if (!this.canContest(ap, bp)) continue;
        const dx = a.x - b.x,
          dy = a.y - b.y,
          vx = (Math.cos(a.angle) * a.speed - Math.cos(b.angle) * b.speed) * dt,
          vy = (Math.sin(a.angle) * a.speed - Math.sin(b.angle) * b.speed) * dt;
        const u = clamp(-(dx * vx + dy * vy) / (vx * vx + vy * vy || 1), 0, 1);
        if (Math.hypot(dx + vx * u, dy + vy * u) > a.r + b.r) continue;
        const point = {
          world: a.world,
          x:
            (a.x +
              Math.cos(a.angle) * a.speed * dt * u +
              b.x +
              Math.cos(b.angle) * b.speed * dt * u) /
            2,
          y:
            (a.y +
              Math.sin(a.angle) * a.speed * dt * u +
              b.y +
              Math.sin(b.angle) * b.speed * dt * u) /
            2,
        };
        if (!this.clearSight(a, point) || !this.clearSight(b, point)) continue;
        if (this.startClash(ap, bp, "beam", point, [{ ...a }, { ...b }]))
          a.life = b.life = 0;
      }
  };
  Engine.prototype.act = function (id, name) {
    const p = this.players.get(id);
    if (p?.clashId) {
      if (["attack", "attackStart"].includes(name))
        return this.clashPulse(p, "attack");
      if (["blast", "blastStart"].includes(name))
        return this.clashPulse(p, "ki");
      return false;
    }
    const before = p && { form: p.form, kaioken: p.kaiokenUntil };
    const result = act.call(this, id, name);
    if (
      p &&
      result &&
      ((name === "form" && p.form && !before.form) ||
        (name === "kaioken" &&
          p.kaiokenUntil > this.time &&
          !(before.kaioken > this.time)))
    ) {
      if ((p.auraPushUntil || 0) <= this.time) {
        p.auraPushUntil = this.time + 8;
        for (const e of [...this.players.values(), ...this.enemies])
          if (
            this.canContest(p, e) &&
            distance(p, e) < 230 &&
            this.clearSight(p, e)
          ) {
            if (e.clashId) this.endClash(this.clashes.get(e.clashId), true);
            this.repel(p, e, 720 * (1 - distance(p, e) / 460));
          }
        this.emit("collisionBurst", p, {
          radius: 230,
          text: "ONDA DE DESPERTAR",
          heavy: true,
        });
      }
    }
    return result;
  };
  Engine.prototype.input = function (id, data) {
    const p = this.players.get(id),
      guard = p?.input.guard;
    input.call(this, id, data);
    if (p?.clashId && !guard && p.input.guard) this.clashPulse(p, "guard");
  };
  Engine.prototype.damage = function (a, b, amount, heavy) {
    if (b.clashId && this.canContest(a, b))
      this.endClash(this.clashes.get(b.clashId), true);
    return damage.call(this, a, b, amount, heavy);
  };
  Engine.prototype.tick = function (dt = 1 / 30) {
    tick.call(this, dt);
    for (const c of [...(this.clashes?.values() || [])]) {
      const pair = c.ids.map((id) => this.fighterById(id));
      if (
        !pair.every(
          (e) =>
            e &&
            e.hp > 0 &&
            e.clashId === c.id &&
            e.world === c.world &&
            (e.duelId || null) === c.duelId,
        ) ||
        !this.canContest(...pair)
      ) {
        this.endClash(c, true);
        continue;
      }
      const elapsed = this.time - c.start,
        beat = Math.floor(elapsed / c.period);
      for (let i = 0; i < 2; i++)
        if (!this.players.has(pair[i].id)) {
          const e = pair[i],
            rank = Motor.tier(e),
            seed =
              ((beat + 1) * 37 + (Number(e.id.replace(/\D/g, "")) || 1) * 17) %
              100;
          const fraction = elapsed / c.period - beat;
          if (fraction >= [0.7, 0.6, 0.5][rank] && seed < [65, 82, 94][rank])
            this.clashPulse(
              e,
              c.type === "beam" ? "ki" : beat % 2 ? "guard" : "attack",
            );
        }
      if (this.time >= c.ends) this.endClash(c);
    }
    const dashers = [...this.players.values()].filter(
      (p) =>
        p.state === "dash" &&
        !p.clashId &&
        (p.bodyImpactAt ?? -99) + 1 < this.time,
    );
    for (let i = 0; i < dashers.length; i++)
      for (let j = i + 1; j < dashers.length; j++) {
        const a = dashers[i],
          b = dashers[j];
        if (
          a.state !== "dash" ||
          b.state !== "dash" ||
          !this.canContest(a, b) ||
          distance(a, b) > 72 ||
          a.vx * b.vx + a.vy * b.vy >= 0 ||
          a.vx * (b.x - a.x) + a.vy * (b.y - a.y) <= 0 ||
          b.vx * (a.x - b.x) + b.vy * (a.y - b.y) <= 0 ||
          !this.clearSight(a, b)
        )
          continue;
        this.dualImpact(a, b);
      }
  };
  Engine.prototype.snapshot = function (id) {
    const s = snapshot.call(this, id);
    if (!s) return s;
    const p = this.players.get(id),
      c = this.clashes?.get(p.clashId);
    s.clashes = [...(this.clashes?.values() || [])]
      .filter((q) => q.world === p.world && distance(q, p) < 1500)
      .map((q) => ({
        id: q.id,
        type: q.type,
        x: q.x,
        y: q.y,
        start: q.start,
        ends: q.ends,
        ids: q.ids,
        scores: q.scores,
        anchors: q.ids.map((id) => {
          const e = this.fighterById(id);
          return e ? { x: e.x, y: e.y } : null;
        }),
      }));
    s.self.clash = c
      ? {
          id: c.id,
          type: c.type,
          start: c.start,
          ends: c.ends,
          period: c.period,
          side: c.ids.indexOf(id),
          scores: c.scores,
        }
      : null;
    for (const e of [...s.players, ...s.enemies, s.self]) {
      const original = this.fighterById(e.id);
      e.clashType = this.clashes?.get(original?.clashId)?.type || null;
    }
    s.self.beamControl = this.shots.some(
      (b) => b.owner === id && b.steerUntil > this.time,
    );
    return s;
  };
};
