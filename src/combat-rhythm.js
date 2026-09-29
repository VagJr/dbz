"use strict";
const C = require("../shared/combat");
const { TECHNIQUES } = require("../shared/content");
const Motion = require("./combat-motion");
const Hitboxes = require("../shared/hitboxes");
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  front = (a, b) => Math.cos(Math.atan2(b.y - a.y, b.x - a.x) - a.angle) > 0.35;
function acquireMeleeTarget(engine, player, move, range) {
  const reach = Hitboxes.meleeReach(player, move);
  return engine.combatTargets(player, range)
    .filter((e) => Hitboxes.sameLayer(player, e) && engine.clearSight(player, e))
    .filter((e) => dist(player, e) <= reach + Hitboxes.body(e).radius * 1.8)
    .filter((e) => !player.input.manualAim ||
      dist(player, e) <= Hitboxes.body(player).radius + Hitboxes.body(e).radius + 12 ||
      Math.cos(Math.atan2(e.y - player.y, e.x - player.x) - player.input.angle) > 0.5)
    .sort((a, b) => {
      const score = (e) => dist(player, e) -
        (e.id === player.comboTargetId ? 8 : 0) -
        (e.id === player.targetId ? 4 : 0) +
        (player.input.manualAim ? Math.abs(Math.atan2(
          Math.sin(Math.atan2(e.y - player.y, e.x - player.x) - player.input.angle),
          Math.cos(Math.atan2(e.y - player.y, e.x - player.x) - player.input.angle),
        )) * 12 : 0);
      return score(a) - score(b);
    })[0] || null;
}
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
    const m=C.moves[key];
    const kiFreePunch = ["jab", "link"].includes(key);
    if (
      !m ||
      p.moveAction ||
      p.stun > t ||
      p.state === "dead" ||
      (!kiFreePunch && p.ki < m.ki) ||
      p.input.guard ||
      p.roundLocked
    )
      return false;
    if(p.aimReceived && t-p.inputAt<.25)p.angle=p.input.angle;
    const mobileMelee = !m.speed && p.input.mobileAssist && !p.input.manualAim;
    const motion = Motion(p, key, (p.attackSequence || 0) + 1);
    const assistRange = m.speed ? Math.min(650, m.range) : m.range + m.step + 42;
    const assisted = p.input.mobileAssist && !p.input.manualAim
      ? this.combatTargets(p, assistRange)
          .filter((e) => (!mobileMelee || Hitboxes.sameLayer(p, e)) && this.clearSight(p, e))
          .sort((a, b) => dist(p, a) - dist(p, b))
      : [];
    const selected = assisted.find((e) => e.id === p.targetId);
    const mobileTarget = selected && (!assisted[0] || dist(p, selected) <= dist(p, assisted[0]) + 72)
      ? selected : assisted[0];
    // Close-range aim assist is shared by desktop and mobile. Mouse aim remains
    // manual until a valid opponent is inside the actual punch contact envelope.
    const assistedTarget = p.input.mobileAssist && !p.input.manualAim
      ? mobileTarget
      : !m.speed ? acquireMeleeTarget(this, p, { ...m, motion }, assistRange) : null;
    const aim = assistedTarget || this.target(p, m.range);
    if (assistedTarget) p.targetId = assistedTarget.id;
    if (assistedTarget || (!p.input.manualAim && aim && dist(p, aim) < 240 && front(p, aim)))
      p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);
    let magnetTargetId = null;
    if (!m.speed && !mobileMelee) {
      const candidates = this.combatTargets(p, m.range + m.step + 60)
        .filter(e => Hitboxes.sameLayer(p, e) && this.clearSight(p, e))
        .map(e => {
          const targetAngle = Math.atan2(e.y - p.y, e.x - p.x);
          const delta = Math.atan2(Math.sin(targetAngle - p.angle), Math.cos(targetAngle - p.angle));
          return { e, targetAngle, delta, score: dist(p, e) + Math.abs(delta) * 170 };
        })
        .filter(c => Math.abs(c.delta) <= 0.48);
      const target = candidates.sort((a, b) => {
        const aBias = a.e.id === p.comboTargetId ? -45 : a.e.id === p.targetId ? -20 : 0;
        const bBias = b.e.id === p.comboTargetId ? -45 : b.e.id === p.targetId ? -20 : 0;
        return a.score + aBias - b.score - bBias;
      })[0];
      if (target && dist(p, target.e) <= m.range + m.step + 42) {
        magnetTargetId = target.e.id;
        p.angle += target.delta * 0.24;
      }
    }
    p.ki = Math.max(0,p.ki-m.ki);
    const tempo=1;
    p.attackSequence=(p.attackSequence||0)+1;
    p.lastCombatAt = t;
    p.chargeAt = null;
    p.meleeAt = null;
    p.queuedAttack = null;
    p.rhythmQueue = null;
    p.rhythmTail = null;
    p.moveAction = {
      key,
      start: t,
      impact: t + m.startup*tempo,
      activeEnd: t + (m.startup+m.active)*tempo,
      end: t + (m.startup+m.active+m.recovery)*tempo,
      exhausted:false,damageScale:1,
      motion:Motion(p,key,p.attackSequence),
      angle: p.angle,
      assistedTargetId: !m.speed ? assistedTarget?.id || null : null,
      magnetTargetId,
      hits: [],
      hit: false,
    };
    p.moveAction.hitWindowEnd = Math.min(
      p.moveAction.end,
      p.moveAction.impact + Math.max(m.active, 3 / 30),
    );
    p.cooldowns[
      key === "ki" || key === "charged" || key === "weave" ? "blast" : "attack"
    ] = p.moveAction.end;
    p.state = "windup";
    p.attackAt = p.moveAction.impact;
    p.windupAt = t;
    p.pattern = "cone";
    p.telegraphRadius = m.speed ? m.range : Hitboxes.meleeReach(p, { ...m, motion: p.moveAction.motion });
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
      p.rhythmTail = null;
      return true;
    }
    if (!p.moveAction && p.rhythmQueue?.pressAt != null) {
      const q = p.rhythmQueue;
      const press = q.pressAt != null ? q : p.rhythmTail?.pressAt != null ? p.rhythmTail : null;
      if (name === "attackRelease" && press?.kind === "melee") {
        press.action = t - press.pressAt >= 0.45 ? "heavy" : "jab";
        press.pressAt = null;
        p.meleeAt = null;
      } else if (name === "blast" && press?.kind === "ki") {
        press.action = t - press.pressAt >= 0.55 ? "charged" : "ki";
        press.pressAt = null;
        p.chargeAt = null;
      }
      if (q.pressAt == null) {
        const tail = p.rhythmTail;
        p.rhythmQueue = null;
        p.rhythmTail = null;
        if (q.expires < t) return false;
        const key = q.action === "charged" ? "charged"
          : q.action === "heavy" ? "heavy"
            : q.action === "ki" ? (p.comboConfirmed === 2 ? "weave" : "ki")
              : this.nextCombo(p);
        const began = this.beginMove(p, key);
        if (began && tail) {
          tail.expires = p.moveAction.end + C.buffer;
          p.rhythmQueue = tail;
        }
        return began;
      }
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
      p.rhythmTail = null;
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
      if (p.rhythmQueue) {
        const q = p.rhythmQueue;
        const press = q.pressAt != null ? q : p.rhythmTail?.pressAt != null ? p.rhythmTail : null;
        if (name === "attackRelease" && press?.kind === "melee") {
          press.action = t - press.pressAt >= 0.45 ? "heavy" : "jab";
          press.pressAt = null;
          p.meleeAt = null;
          return true;
        }
        if (name === "blast" && press?.kind === "ki") {
          press.action = t - press.pressAt >= 0.55 ? "charged" : "ki";
          press.pressAt = null;
          p.chargeAt = null;
          return true;
        }
      }
      if (
        ["attack", "attackStart", "blast", "blastStart"].includes(name) &&
        (["jab","link","finisher"].includes(p.moveAction.key) || p.moveAction.end - t <= C.buffer ||
          (p.moveAction.hit && ["jab", "link"].includes(p.moveAction.key))) &&
        !p.rhythmQueue
      ) {
        const kind = name.startsWith("blast") || name === "blast" ? "ki" : "melee";
        const pressAt = name === "attackStart" ? t : name === "blastStart" ? t : null;
        if (name === "attackStart") p.meleeAt = t;
        if (name === "blastStart") p.chargeAt = t;
        const entry = {
          action: kind === "ki" ? "ki" : "jab",
          kind,
          pressAt,
          expires: pressAt == null ? p.moveAction.end + C.buffer : t + 1.5,
        };
        if (!p.rhythmQueue) p.rhythmQueue = entry;
        else p.rhythmTail = entry;
        return true;
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
      p.rhythmTail = null;
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
        z: Hitboxes.attackHeight(p, move),
        originZ: Hitboxes.attackHeight(p, move),
        visualOffset: Hitboxes.attackHeight(p, move) - Hitboxes.height(p),
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
      const technique = move.key === "weave" ? null : TECHNIQUES.find((item) => item.id === p.equipped);
      this.emit("cast", p, {
        angle: move.angle,
        charged: !!m.heavy,
        technique: move.key === "weave" ? "weave" : p.equipped,
        techniqueName: move.key === "weave" ? "Ruptura de ki" : technique?.name || "Disparo de ki",
      });
      return;
    }
    if (move.resolved) return;
    if (!move.stepped) {
      const nearby = this.combatTargets(p, m.range + m.step + 42)
        .filter(e => Hitboxes.sameLayer(p, e) && this.clearSight(p, e));
      const intended = nearby.find(e => e.id === move.assistedTargetId) ||
        nearby.find(e => e.id === move.magnetTargetId) ||
        nearby.find(e => e.id === p.targetId);
      const toward = intended && Math.cos(Math.atan2(intended.y - p.y, intended.x - p.x) - move.angle) > 0.35;
      const close = toward ? intended : null;
      const reach = Hitboxes.meleeReach(p, { ...m, motion: move.motion });
      const stopDistance = close ? Math.max(
        Hitboxes.body(p).radius + Hitboxes.body(close).radius - 2,
        Math.min(34, reach + Hitboxes.body(close).radius * 0.6),
      ) : 0;
      // A point-blank punch must not step through the target before its
      // contact frame. Extend the approach only when the same target needs it.
      const advance = close
        ? Math.min(m.step + 42, Math.max(0, dist(p, close) - stopDistance))
        : m.step;
      this.move(
        p,
        Math.cos(move.angle) * advance,
        Math.sin(move.angle) * advance,
      );
      move.stepped = true;
      this.emit("slash", p, { angle: move.angle, combo: p.combo });
    }
    const strike = { ...m, motion: move.motion };
    const targets = this.combatTargets(p, m.range + 12)
      .filter((e) => this.clearSight(p, e))
      .map((e) => ({
        e,
        contact: Hitboxes.meleeHit(p, e, strike, move.angle) ||
          Hitboxes.contactHit(p, e, move, move.angle),
      }))
      .filter((candidate) => candidate.contact);
    const selected = targets.find((candidate) => candidate.e.id === p.targetId) ||
      targets.sort((a, b) => dist(p, a.e) - dist(p, b.e))[0];
    if (!selected || move.hits.length) {
      if (t < (move.hitWindowEnd || move.activeEnd) - 1e-7) return;
      move.resolved = true;
      move.result = "miss";
      return;
    }
    const { e, contact } = selected;
    move.hits.push(e.id);
    const hp = e.hp,
      blocked = e.state === "guard" && Hitboxes.guardArc(e, { ...p, attackData: { contact } });
    p.attackData = { posture: m.posture*(move.exhausted?.4:1), stun: move.exhausted?.05:m.stun, baseDamage: m.damage*move.damageScale, contact, finisher: move.key === "finisher" };
    p.heavyStrike = move.key === "heavy";
    const counter = p.counterUntil > t ? 1.25 : 1;
    p.counterUntil = 0;
    this.damage(p, e, m.damage * move.damageScale * this.combatMultiplier(p) * counter, !!m.heavy);
    p.attackData = null;
    p.heavyStrike = false;
    move.resolved = true;
    move.targetId = e.id;
    move.damage = Math.max(0, hp - e.hp);
    if (e.hp < hp && !blocked) {
      move.hit = true;
      move.result = "hit";
      p.comboConfirmed = p.combo;
      p.confirmedAt = t;
      p.comboTargetId = e.id;
      p.targetId = e.id;
      p.focus = Math.min(100, p.focus + 4);
      if (!move.exhausted) {
        const kiRecovery =
          move.key === "jab"
            ? 3
            : move.key === "link"
              ? 4
              : move.key === "finisher"
                ? 9
                : move.key === "heavy"
                  ? 4
                  : 0;
        p.ki = Math.min(100, p.ki + kiRecovery);
      }
      if (move.key === "finisher") e.chaseUntil = t + 0.8;
    } else {
      move.result = blocked ? "blocked" : e.invuln > t ? "evaded" : "no-damage";
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
    if (this.players.has(b.id) && !this.players.has(a.id) && this.onboardingProtected(b,a)) return;
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
    if (!this.players.has(b.id) && this.players.has(a.id)) b.provokedBy = a.id;
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
    const guarding = b.state === "guard" && Hitboxes.guardArc(b, a),
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
        b.rhythmTail = null;
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
          p.rhythmTail = null;
        } else {
          if (!m.resolved && this.time < (m.hitWindowEnd || m.activeEnd) && !C.moves[m.key].speed) {
            const reach = C.moves[m.key].range + C.moves[m.key].step + 42;
            const closeTarget = acquireMeleeTarget(
              this,
              p,
              { ...C.moves[m.key], motion: m.motion },
              reach,
            );
            if (closeTarget) {
              p.targetId = closeTarget.id;
              m.assistedTargetId = closeTarget.id;
              m.angle = Math.atan2(closeTarget.y - p.y, closeTarget.x - p.x);
            } else if (p.input.mobileAssist && !p.input.manualAim) {
              const candidates = this.combatTargets(p, reach)
                .filter(e => Hitboxes.sameLayer(p, e) && this.clearSight(p, e))
                .sort((a, b) => dist(p, a) - dist(p, b));
              const selected = candidates.find(e => e.id === p.targetId || e.id === m.assistedTargetId);
              const target = selected && (!candidates[0] || dist(p, selected) <= dist(p, candidates[0]) + 72)
                ? selected : candidates[0];
              if (target) {
                p.targetId = target.id;
                m.assistedTargetId = target.id;
                m.angle = Math.atan2(target.y - p.y, target.x - p.x);
              }
            } else if (p.aimReceived && this.time - p.inputAt < 0.25) {
              m.angle = p.input.angle;
              const candidates = this.combatTargets(p, reach)
                .filter(e => Hitboxes.sameLayer(p, e) && this.clearSight(p, e))
                .map(e => {
                  const angle = Math.atan2(e.y - p.y, e.x - p.x);
                  const delta = Math.atan2(Math.sin(angle - m.angle), Math.cos(angle - m.angle));
                  return { e, angle, delta, score: dist(p, e) + Math.abs(delta) * 170 };
                })
                .filter(c => Math.abs(c.delta) <= 0.48)
                .sort((a, b) => {
                  const aBias = a.e.id === p.comboTargetId ? -45 : a.e.id === p.targetId ? -20 : 0;
                  const bBias = b.e.id === p.comboTargetId ? -45 : b.e.id === p.targetId ? -20 : 0;
                  return a.score + aBias - b.score - bBias;
                });
              const target = candidates[0];
              if (target && dist(p, target.e) <= reach) {
                m.magnetTargetId = target.e.id;
                m.angle += target.delta * 0.24;
              }
            } else if (m.assistedTargetId) {
              const target = this.combatTargets(p, reach)
                .find(e => e.id === m.assistedTargetId && Hitboxes.sameLayer(p, e) && this.clearSight(p, e));
              if (target) m.angle = Math.atan2(target.y - p.y, target.x - p.x);
            }
          }
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
        this.time < (m.hitWindowEnd || m.activeEnd)-1e-7
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
      if (!m) {
        if (p.rhythmQueue?.expires < this.time) {
          p.rhythmQueue = null;
          p.rhythmTail = null;
        }
        continue;
      }
      if (p.stun > this.time || p.state === "dead") {
        p.moveAction = null;
        p.rhythmQueue = null;
        p.rhythmTail = null;
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
        p.rhythmQueue.pressAt == null &&
        m.hit &&
        ["jab", "link"].includes(m.key) &&
        this.time >= m.activeEnd + 1 / 30;
      if (this.time+1e-7 >= m.end || cancel) {
        if (!C.moves[m.key].speed && !m.resolved) {
          m.resolved = true;
          m.result = "miss";
        }
        if (!m.hit && !C.moves[m.key].speed) p.comboConfirmed = 0;
        p.moveAction = null;
        p.state = "idle";
        const q = p.rhythmQueue;
        if (q && q.expires >= this.time && q.pressAt == null) {
          const tail = p.rhythmTail;
          p.rhythmQueue = null;
          p.rhythmTail = null;
          const key = q.action === "charged" ? "charged"
            : q.action === "heavy" ? "heavy"
              : q.action === "ki" ? (p.comboConfirmed === 2 ? "weave" : "ki")
                : this.nextCombo(p);
          const began = this.beginMove(p, key);
          if (began && tail) {
            tail.expires = p.moveAction.end + C.buffer;
            p.rhythmQueue = tail;
          }
        } else if (!q || q.expires < this.time) {
          p.rhythmQueue = null;
          p.rhythmTail = null;
        }
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
            result: q.moveAction.result || null,
            targetId: q.moveAction.targetId || null,
            damage: q.moveAction.damage || 0,
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
    s.self.queuedAction = p.rhythmQueue
      ? { action: p.rhythmQueue.action, kind: p.rhythmQueue.kind, expires: p.rhythmQueue.expires, count: 1 + (p.rhythmTail ? 1 : 0), tailKind: p.rhythmTail?.kind || null }
      : null;
    s.self.counterUntil = p.counterUntil || 0;
    const enemyById = new Map(this.enemies.map(e => [e.id, e]));
    for (const e of s.enemies) {
      const original = enemyById.get(e.id);
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
