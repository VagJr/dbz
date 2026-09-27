"use strict";
const C = require("../shared/combat");
const Motion = require("./combat-motion");
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  front = (a, b) => Math.cos(Math.atan2(b.y - a.y, b.x - a.x) - a.angle) > 0.35;
module.exports = (Engine) => {
  const act = Engine.prototype.act,
    tick = Engine.prototype.tick,
    damage = Engine.prototype.damage,
    snapshot = Engine.prototype.snapshot;
  Engine.prototype.combatTargets = function (p, range) {
    return [...this.enemies, ...this.players.values()].filter(
      (e) =>
        e.id !== p.id &&
        !e.dead &&
        e.state !== "dead" &&
        e.world === p.world &&
        dist(p, e) <= range &&
        (!e.practiceOwner || e.practiceOwner === p.id) &&
        ((!p.duelId && !e.duelId) || (p.duelId && p.duelId === e.duelId)) &&
        (!this.players.has(e.id) || (p.pvp && e.pvp)),
    );
  };
  Engine.prototype.target = function (p, range) {
    const list = this.combatTargets(p, range);
    return (
      list.find((e) => e.id === p.targetId) ||
      list.filter((e) => front(p, e)).sort((a, b) => dist(p, a) - dist(p, b))[0]
    );
  };
  Engine.prototype.beginMove = function (p, key) {
    const t = this.time;
    const basic=["jab","link","finisher"].includes(key);
    const exhausted=basic&&p.ki<(C.moves[key]?.ki||0);
    if(exhausted)key="jab";
    const m=C.moves[key];
    if (
      !m ||
      p.moveAction ||
      p.stun > t ||
      p.state === "dead" ||
      (!basic && p.ki < m.ki) ||
      p.input.guard ||
      p.roundLocked
    )
      return false;
    if(p.aimReceived && t-p.inputAt<.25)p.angle=p.input.angle;
    const aim = this.target(p, m.range);
    if (!p.input.manualAim && aim && dist(p, aim) < 240 && front(p, aim))
      p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);
    p.ki = Math.max(0,p.ki-m.ki);
    const tempo=exhausted?2:1;
    p.attackSequence=(p.attackSequence||0)+1;
    p.lastCombatAt = t;
    p.chargeAt = null;
    p.meleeAt = null;
    p.queuedAttack = null;
    p.rhythmQueue = null;
    p.moveAction = {
      key,
      start: t,
      impact: t + m.startup*tempo,
      activeEnd: t + (m.startup+m.active)*tempo,
      end: t + (m.startup+m.active+m.recovery)*tempo,
      exhausted,damageScale:exhausted?.4:1,
      motion:Motion(p,key,p.attackSequence),
      angle: p.angle,
      hits: [],
      hit: false,
    };
    p.cooldowns[
      key === "ki" || key === "charged" || key === "weave" ? "blast" : "attack"
    ] = p.moveAction.end;
    p.state = "windup";
    p.attackAt = p.moveAction.impact;
    p.windupAt = t;
    p.pattern = "cone";
    p.telegraphRadius = m.range;
    p.vx *= basic ? .9 : .3;
    p.vy *= basic ? .9 : .3;
    p.combo = key === "link" ? 2 : key === "finisher" ? 3 : 1;
    this.emit("chargeStart", p, { text: m.name, angle: p.angle });
    return true;
  };
  Engine.prototype.act = function (id, name) {
    const p = this.players.get(id),
      t = this.time;
    if (!p || typeof name !== "string") return false;
    if (name !== "cancelCharge") p.sandboxJob = null;
    if (name === "cycleTarget" || name.startsWith("target:")) {
      const list = this.combatTargets(p, 1000).sort(
        (a, b) => dist(p, a) - dist(p, b),
      );
      const next =
        name === "cycleTarget"
          ? list[(list.findIndex((e) => e.id === p.targetId) + 1) % list.length]
          : list.find((e) => e.id === name.slice(7));
      p.targetId = next?.id || null;
      return !!next;
    }
    if (name === "cancelCharge") {
      p.chargeAt = null;
      p.meleeAt = null;
      p.rhythmQueue = null;
      return true;
    }
    if (p.state === "dead" || p.roundLocked) return false;
    if (name === "dash" && p.stun > t) {
      if (p.ki < C.burstCost || (p.cooldowns.burst || 0) > t) return false;
      p.ki -= C.burstCost;
      p.cooldowns.burst = t + C.burstCooldown;
      p.stun = 0;
      p.launch = null;
      p.moveAction = null;
      p.rhythmQueue = null;
      p.invuln = t + 0.25;
      p.counterUntil = 0;
      p.lastCombatAt = t;
      const a = p.input.angle || p.angle;
      this.move(p, -Math.cos(a) * 100, -Math.sin(a) * 100);
      this.emit("break", p, { text: "RUPTURA DEFENSIVA" });
      return true;
    }
    if (p.stun > t) return false;
    if (
      p.training &&
      ["attack", "attackStart", "attackRelease"].includes(name)
    ) {
      if (name === "attackRelease") return false;
      return act.call(this, id, "attack");
    }
    if (p.moveAction) {
      if (
        ["attack", "attackStart", "blast", "blastStart"].includes(name) &&
        (["jab","link","finisher"].includes(p.moveAction.key) || p.moveAction.end - t <= C.buffer ||
          (p.moveAction.hit && ["jab", "link"].includes(p.moveAction.key))) &&
        !p.rhythmQueue
      ) {
        p.rhythmQueue = {
          action: name.startsWith("blast") ? "ki" : "jab",
          expires: p.moveAction.end + C.buffer,
        };
        return false;
      }
      if (
        [
          "dash",
          "flight",
          "orbit",
          "form",
          "kaioken",
          "attack",
          "attackStart",
          "attackRelease",
          "blast",
          "blastStart",
        ].includes(name)
      )
        return false;
    }
    if (name === "attackStart") {
      if (p.meleeAt != null) return false;
      p.meleeAt = t;
      return true;
    }
    if (name === "attackRelease") {
      if (p.meleeAt == null) return false;
      const held = t - p.meleeAt;
      p.meleeAt = null;
      return this.beginMove(p, held >= 0.45 ? "heavy" : this.nextCombo(p));
    }
    if (name === "attack") return this.beginMove(p, this.nextCombo(p));
    if (name === "blastStart") {
      if (p.chargeAt != null || (p.cooldowns.blast || 0) > t) return false;
      p.chargeAt = t;
      return true;
    }
    if (name === "blast") {
      const held = p.chargeAt == null ? 0 : t - p.chargeAt;
      p.chargeAt = null;
      if ((p.cooldowns.blast || 0) > t) return false;
      return this.beginMove(
        p,
        held >= 0.55
          ? "charged"
          : p.comboConfirmed === 2 && t - p.confirmedAt < C.comboWindow
            ? "weave"
            : "ki",
      );
    }
    if (name === "dash") {
      if (p.ki < C.dashCost || (p.cooldowns.dash || 0) > t) return false;
      p.ki -= C.dashCost;
      p.cooldowns.dash = t + C.dashCooldown;
      p.lastCombatAt = t;
      p.meleeAt = null;
      p.chargeAt = null;
      p.rhythmQueue = null;
      const e = this.target(p, 400),
        chase =
          p.comboConfirmed === 3 &&
          t - p.confirmedAt < 0.8 &&
          e?.chaseUntil > t;
      if (chase && p.ki >= 8) {
        p.ki -= 8;
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        this.move(
          p,
          Math.cos(a) * Math.min(220, dist(p, e) - 90),
          Math.sin(a) * Math.min(220, dist(p, e) - 90),
        );
        p.comboConfirmed = 0;
      }
      const a =
        Math.hypot(p.input.x, p.input.y) > 0.1
          ? Math.atan2(p.input.y, p.input.x)
          : p.angle;
      p.state = "dash";
      p.until = t + 0.22;
      p.invuln = t + 0.16;
      p.vx = Math.cos(a) * 680;
      p.vy = Math.sin(a) * 680;
      this.emit("dash", p, {
        angle: a,
        text: chase ? "PERSEGUIÇÃO" : undefined,
      });
      return true;
    }
    return act.call(this, id, name);
  };
  Engine.prototype.nextCombo = function (p) {
    return this.time - (p.confirmedAt ?? -99) < C.comboWindow &&
      p.comboTargetId === p.targetId &&
      p.comboConfirmed === 1
      ? "link"
      : this.time - (p.confirmedAt ?? -99) < C.comboWindow &&
          p.comboTargetId === p.targetId &&
          p.comboConfirmed === 2
        ? "finisher"
        : "jab";
  };
  Engine.prototype.resolveMove = function (p, move) {
    const m = C.moves[move.key],
      t = this.time;
    if (m.speed) {
      if (move.fired) return;
      move.fired = true;
      this.shots.push({
        id: "s" + ++this.serial,
        owner: p.id,
        world: p.world,
        mode: p.mode,
        x: p.x,
        y: p.y,
        originX: p.x,
        originY: p.y,
        angle: move.angle,
        speed: m.speed,
        r: m.heavy ? 18 : 9,
        life: m.range / m.speed,
        damage: m.damage * this.combatMultiplier(p),
        baseDamage: m.damage,
        posture: m.posture,
        charged: move.key === "charged",
        initialAngle: move.angle,
        steerUntil: move.key === "charged" ? t + 0.65 : 0,
        pierce: !!m.heavy,
        hits: [],
        technique: move.key === "weave" ? "weave" : p.equipped,
        skin: p.skin,
        weave: move.key === "weave",
      });
      p.comboConfirmed = 0;
      if (!p.duelId)
        p.mastery[p.equipped] = Math.min(100, (p.mastery[p.equipped] || 0) + 1);
      this.emit("cast", p, { angle: move.angle, charged: !!m.heavy });
      return;
    }
    if (!move.stepped) {
      this.move(
        p,
        Math.cos(move.angle) * m.step,
        Math.sin(move.angle) * m.step,
      );
      move.stepped = true;
      this.emit("slash", p, { angle: move.angle, combo: p.combo });
    }
    const targets = this.combatTargets(p, m.range).filter(
      (e) => front({ ...p, angle: move.angle }, e) && this.clearSight(p, e),
    );
    const e = targets.find((e) => e.id === p.targetId) || targets[0];
    if (!e || move.hits.length) return;
    move.hits.push(e.id);
    const hp = e.hp,
      blocked = e.state === "guard" && front(e, p);
    p.attackData = { posture: m.posture*(move.exhausted?.4:1), stun: move.exhausted?.05:m.stun, baseDamage: m.damage*move.damageScale };
    p.heavyStrike = move.key === "heavy";
    const counter = p.counterUntil > t ? 1.25 : 1;
    p.counterUntil = 0;
    this.damage(p, e, m.damage * move.damageScale * this.combatMultiplier(p) * counter, !!m.heavy);
    p.attackData = null;
    p.heavyStrike = false;
    if (e.hp < hp && !blocked) {
      move.hit = true;
      p.comboConfirmed = p.combo;
      p.confirmedAt = t;
      p.comboTargetId = e.id;
      p.targetId = e.id;
      p.focus = Math.min(100, p.focus + 4);
      if (move.key === "finisher") e.chaseUntil = t + 0.8;
    } else {
      p.comboConfirmed = 0;
      p.comboTargetId = null;
    }
  };
  Engine.prototype.combatMultiplier = function (p) {
    return p.duelId
      ? 1
      : 1 +
          Math.min(0.35, (p.level - 1) * 0.008 + (p.stats.force || 0) * 0.006) +
          (p.form ? 0.15 : 0);
  };
  Engine.prototype.damage = function (a, b, amount, heavy) {
    if (a.duelId || b.duelId) {
      if (!a.duelId || a.duelId !== b.duelId || a.roundLocked || b.roundLocked)
        return;
    } else if (
      this.players.has(a.id) &&
      this.players.has(b.id) &&
      (!a.pvp || !b.pvp)
    )
      return;
    if (b.dead || b.state === "dead") return;
    if (b.invuln > this.time) {
      if (
        this.players.has(b.id) &&
        b.state === "dash" &&
        (b.lastPerfectEvade ?? -10) + 1 < this.time
      ) {
        b.lastPerfectEvade = this.time;
        b.focus = Math.min(100, b.focus + 8);
        b.counterUntil = this.time + 0.55;
        this.emit("parry", b, { text: "ESQUIVA PRECISA" });
      }
      return;
    }
    const t = this.time,
      isPlayer = this.players.has(b.id);
    a.lastCombatAt = t;
    b.lastCombatAt = t;
    if (b.cell) b.provokedBy = a.id;
    // Consecutive hits scale down; defense and invulnerability remain authoritative.
    if (
      (a.attackData || a.projectile) &&
      b.juggleSource === a.id &&
      t - (b.juggleAt || 0) < 1.2
    ) {
      b.juggleCount = (b.juggleCount || 1) + 1;
      amount *= Math.max(0.35, 1 - (b.juggleCount - 1) * 0.12);
    } else {
      b.juggleSource = a.id;
      b.juggleCount = 1;
    }
    b.juggleAt = t;
    const guarding = b.state === "guard" && front(b, a),
      hp = b.hp,
      oldStun = b.stun;
    if (!isPlayer && guarding && a.attackData) {
      const expected = heavy || a.kiWeave ? 45 : 15;
      b.guardMeter = (b.guardMeter ?? 70) + expected - a.attackData.posture;
    }
    damage.call(this, a, b, amount, heavy);
    if (b.hp < hp) {
      if (!isPlayer && !guarding) {
        b.recentPressure =
          t - (b.pressureHitAt ?? -99) < 1
            ? Math.min(4, (b.recentPressure || 0) + 1)
            : 1;
        b.pressureHitAt = t;
        b.attackInterruptedAt = t;
        b.attackAt = Infinity;
        b.pressureUntil = 0;
        b.guardUntil = 0;
        b.counterReadyUntil = 0;
        b.confirmedHits = 0;
        b.recoveryUntil = 0;
        b.cooldown = Math.min(b.cooldown || 0, t + 0.16);
        b.nextOpening = Math.min(b.nextOpening || 0, t + 0.16);
        b.state = "stun";
      }
      if (b.moveAction) {
        b.moveAction = null;
        b.rhythmQueue = null;
        b.comboConfirmed = 0;
        b.chargeAt = null;
        b.meleeAt = null;
      }
      if (!guarding) {
        b.stun = Math.max(b.stun, t + (a.attackData?.stun || 0.2));
        if (!heavy && b.launch) {
          b.launch.x *= 0.25;
          b.launch.y *= 0.25;
          b.launch.left = 0.1;
        }
        if (b.juggleCount >= 4) {
          b.stun = Math.min(b.stun, t + 0.12);
          b.launch = null;
          b.invuln = t + 0.25;
          this.emit("parry", b, { text: "RECOMPONHA A GUARDA" });
        }
      } else if (isPlayer && b.ki > 0) {
        b.launch = null;
        b.stun = Math.max(oldStun, t + 1/30);
      }
    }
  };
  Engine.prototype.tick = function (dt = 1 / 30) {
    for (const p of this.players.values()) {
      const m = p.moveAction;
      if (m) {
        if (p.stun > this.time || p.state === "dead") {
          p.moveAction = null;
          p.rhythmQueue = null;
        } else {
          if(this.time<m.impact && ["jab","link","finisher"].includes(m.key) && p.aimReceived && this.time-p.inputAt<.25)m.angle=p.input.angle;
          p.angle = m.angle;
          p.state =
            this.time < m.impact
              ? "windup"
              : this.time < m.activeEnd
                ? "attack"
                : "recover";
        }
      }
    }
    this.combatIntents = [];
    tick.call(this, dt);
    // Resolve melee by scheduled impact, independent of player/NPC iteration order.
    const intents = this.combatIntents;
    this.combatIntents = null;
    for (const p of this.players.values()) {
      const m = p.moveAction;
      if (
        m &&
        p.stun <= this.time &&
        p.state !== "dead" &&
        this.time+1e-7 >= m.impact &&
        this.time < m.activeEnd-1e-7
      )
        intents.push({
          source: p,
          melee: !C.moves[m.key].speed && !C.moves[m.key].heavy,
          at: Math.max(m.impact, this.time - dt),
          resolve: () => this.resolveMove(p, m),
        });
    }
    intents.sort((a, b) => a.at - b.at);
    while (intents.length) {
      const at = intents[0].at,
        group = [];
      while (intents.length && Math.abs(intents[0].at - at) < 1e-7)
        group.push(intents.shift());
      const candidates = this.tryMeleeClash ? this.tryMeleeClash(group) : group;
      const ready = candidates.filter(
        (i) =>
          !i.source.dead &&
          i.source.state !== "dead" &&
          i.source.stun <= this.time,
      );
      for (const i of ready) i.resolve();
    }
    for (const p of this.players.values()) {
      const m = p.moveAction;
      if (!m) continue;
      if (p.stun > this.time || p.state === "dead") {
        p.moveAction = null;
        p.rhythmQueue = null;
        continue;
      }
      p.angle = m.angle;
      p.state =
        this.time < m.impact
          ? "windup"
          : this.time < m.activeEnd
            ? "attack"
            : "recover";
      const cancel =
        p.rhythmQueue &&
        m.hit &&
        ["jab", "link"].includes(m.key) &&
        this.time >= m.activeEnd + 1 / 30;
      if (this.time+1e-7 >= m.end || cancel) {
        if (!m.hit && !C.moves[m.key].speed) p.comboConfirmed = 0;
        p.moveAction = null;
        p.state = "idle";
        const q = p.rhythmQueue;
        p.rhythmQueue = null;
        if (q && q.expires >= this.time)
          this.beginMove(
            p,
            q.action === "ki"
              ? p.comboConfirmed === 2
                ? "weave"
                : "ki"
              : this.nextCombo(p),
          );
      }
    }
  };
  Engine.prototype.snapshot = function (id) {
    const s = snapshot.call(this, id);
    if (!s) return s;
    const p = this.players.get(id);
    const expose = (q) =>
      q.moveAction
        ? {
            name: C.moves[q.moveAction.key].name,
            confirmed: q.moveAction.hit,
            exhausted:q.moveAction.exhausted,
            motion:q.moveAction.motion,
            key: q.moveAction.key,
            phase: q.state,
            start: q.moveAction.start,
            impact: q.moveAction.impact,
            activeEnd: q.moveAction.activeEnd,
            end: q.moveAction.end,
          }
        : null;
    s.self.combatAction = expose(p);
    s.self.comboConfirmed = p.comboConfirmed || 0;
    s.self.counterUntil = p.counterUntil || 0;
    for (const e of s.enemies) {
      const original = this.enemies.find((q) => q.id === e.id);
      e.combo = original?.motorMove?.stage || 1;
      if (
        original?.motorMove &&
        Number.isFinite(original.attackAt) &&
        ["windup", "attack", "recover"].includes(original.state)
      )
        e.combatAction = {
          name: original.counterStrike ? "Contra-ataque" : "Sequência",
          motion:original.motorMove.motion,
          key:
            original.pattern === "beam"
              ? "ki"
              : original.motorMove.finisher
                ? "finisher"
                : original.motorMove.stage === 2
                  ? "link"
                  : "jab",
          start: original.windupAt,
          impact: original.attackAt,
          activeEnd: original.attackAt + original.motorMove.active,
          end:
            original.attackAt +
            original.motorMove.active +
            original.motorMove.recovery,
        };
    }
    for (const q of s.players) {
      const entity = this.players.get(q.id);
      q.combatAction = expose(entity);
      q.attackAt = entity.attackAt;
      q.windupAt = entity.windupAt;
      q.pattern = entity.pattern;
      q.telegraphRadius = entity.telegraphRadius;
    }
    return s;
  };
};
