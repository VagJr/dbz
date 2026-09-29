"use strict";
const W = require("../shared/open-world");
const Hitboxes = require("../shared/hitboxes");
const Physics = require("../shared/physics");
const CollisionWorld = require("../shared/collision-world");
module.exports = (Engine) => {
  const act = Engine.prototype.act,
    target = Engine.prototype.target,
    tick = Engine.prototype.tick,
    damage = Engine.prototype.damage,
    snapshot = Engine.prototype.snapshot;
  Engine.prototype.target = function (p, range) {
    const selected = this.enemies.find(
      (e) =>
        e.id === p.targetId &&
        !e.dead &&
        e.world === p.world &&
        Math.hypot(e.x - p.x, e.y - p.y) < range,
    );
    return selected || target.call(this, p, range);
  };
  Engine.prototype.act = function (id, name) {
    const p = this.players.get(id);
    if (!p) return false;
    if (name === "blast" && p.cooldowns.blast > this.time) p.chargeAt = null;
    if (name === "cancelCharge") {
      p.meleeAt = null;
      p.queuedAttack = null;
    }
    if (name === "cycleTarget" || name.startsWith("target:")) {
      const list = this.enemies
        .filter(
          (e) =>
            !e.dead &&
            e.world === p.world &&
            Math.hypot(e.x - p.x, e.y - p.y) < 1000,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
        );
      const next =
        name === "cycleTarget"
          ? list[(list.findIndex((e) => e.id === p.targetId) + 1) % list.length]
          : list.find((e) => e.id === name.slice(7));
      p.targetId = next?.id || null;
      return !!next;
    }
    if (p.state === "dead" || p.stun > this.time) {
      p.meleeAt = null;
      p.queuedAttack = null;
      return false;
    }
    if (name === "attackStart") {
      if (p.meleeAt != null) return false;
      p.meleeAt = this.time;
      name = "attack";
    }
    if (name === "attackRelease") {
      const held = p.meleeAt == null ? 0 : this.time - p.meleeAt;
      p.meleeAt = null;
      if (held < 0.5) return false;
      if (p.ki < 18) return false;
      p.queuedAttack = { until: this.time + 0.3, heavy: true };
      return true;
    }
    if (name === "attack" && !p.training && p.cooldowns.attack > this.time) {
      if (p.cooldowns.attack - this.time < 0.32)
        p.queuedAttack = { until: this.time + 0.36, heavy: false };
      return false;
    }
    if (
      name === "dash" &&
      p.combo === 3 &&
      this.time - p.comboAt < 0.85 &&
      p.ki >= 22 &&
      (p.cooldowns.chase || 0) <= this.time
    ) {
      const e = this.target(p, 650);
      if (e && (e.chaseUntil || 0) > this.time) {
        p.ki -= 22;
        p.cooldowns.chase = this.time + 2.8;
        p.combo = 0;
        p.cooldowns.attack = this.time + 0.12;
        const a = Math.atan2(e.y - p.y, e.x - p.x),
          d = Math.hypot(e.x - p.x, e.y - p.y);
        this.move(
          p,
          Math.cos(a) * Math.max(0, d - 80),
          Math.sin(a) * Math.max(0, d - 80),
        );
        p.angle = a;
        p.invuln = this.time + 0.12;
        p.queuedAttack = null;
        p.meleeAt = null;
        this.emit("dash", p, { angle: a, text: "PERSEGUIÇÃO" });
        return true;
      }
    }
    if (name === "dash" || name === "blastStart") {
      p.queuedAttack = null;
      p.meleeAt = null;
    }
    const weave =
      name === "blast" &&
      p.combo === 2 &&
      this.time - p.comboAt < 0.65 &&
      p.ki >= 30 &&
      p.chargeAt != null &&
      this.time - p.chargeAt < 0.45;
    const result = act.call(this, id, name);
    if (weave && result) {
      const shot = this.shots.at(-1);
      if (shot?.owner === p.id) {
        p.ki -= 6;
        p.combo = 0;
        shot.weave = true;
        shot.technique = "weave";
        p.cooldowns.attack = Math.max(p.cooldowns.attack, this.time + 0.3);
        this.emit("cast", p, { angle: p.angle, text: "RUPTURA DE KI" });
      }
    }
    return result;
  };
  Engine.prototype.damage = function (a, b, amount, heavy = false) {
    if (
      (b.practiceOwner && a.id !== b.practiceOwner) ||
      (a.practiceOwner && b.id !== a.practiceOwner)
    )
      return;
    const hp = b.hp,
      oldStun = b.stun,
      oldX = b.x,
      oldY = b.y;
    let blocked = false;
    if (
      this.players.has(b.id) &&
      !this.players.has(a.id) &&
      b.state === "dash" &&
      b.invuln > this.time &&
      (b.lastPerfectEvade || -10) + 1 < this.time
    ) {
      b.lastPerfectEvade = this.time;
      b.focus = Math.min(100, b.focus + 8);
      b.counterUntil = this.time + 0.55;
      this.emit("parry", b, { text: "ESQUIVA PRECISA" });
    }
    if (!this.players.has(b.id) && ["recover", "breathe"].includes(b.state))
      amount *= 1.2;
    if (!this.players.has(b.id) && b.state === "guard") {
      const facing = Hitboxes.guardArc(b, a);
      if (facing) {
        b.guardMeter = (b.guardMeter ?? 70) - (heavy || a.kiWeave ? 45 : 15);
        if (b.guardMeter > 0) {
          amount *= 0.2;
          blocked = true;
          // The base damage handler also has an NPC guard path. This hit was
          // already blocked here, so it must not spend posture or scale damage twice.
          b.flowGuardHandled = true;
          b.effort = Math.max(0, (b.effort ?? 100) - 10);
          b.counterReadyUntil = this.time + 0.9;
          b.nextOpening = Math.min(b.nextOpening || 0, this.time + 0.12);
          b.guardUntil = Math.min(
            b.guardUntil || this.time + 0.12,
            this.time + 0.12,
          );
          this.emit("parry", b, { text: "BLOQUEIO" });
        } else {
          b.state = "stun";
          b.guardUntil = 0;
          b.counterReadyUntil = 0;
          b.stun = this.time + 0.8;
          b.guardBrokenUntil = this.time + 6;
          this.emit("break", b, { text: "GUARDA QUEBRADA" });
        }
      }
    }
    try {
      damage.call(this, a, b, amount, heavy);
    } finally {
      if (blocked) delete b.flowGuardHandled;
    }
    if (b.hp >= hp) return;
    if (blocked) {
      b.stun = oldStun;
      b.x = oldX;
      b.y = oldY;
      b.launch = null;
      return;
    }
    if (a.combo === 3 && heavy) b.chaseUntil = this.time + 0.65;
    const guard = b.state === "guard" && b.ki > 0 && Hitboxes.guardArc(b, a);
    if (guard) return;
    // Brief hitstun resistance prevents an infinite party stun lock.
    b.hitChain =
      this.time - (b.lastHitAt || -10) < 0.7 ? (b.hitChain || 0) + 1 : 1;
    b.lastHitAt = this.time;
    if (!this.players.has(b.id) && b.hitChain > 5) {
      b.launch = null;
      b.stun = Math.min(b.stun, this.time + 0.04);
      return;
    }
    const tier = heavy
        ? amount >= 70 || a.heavyStrike
          ? "high"
          : "mid"
        : "low",
      speed = (tier === "high" ? 1900 : tier === "mid" ? 950 : 160) * Math.max(.45, Math.min(1.3, Math.sqrt(80 / Physics.body(b).mass)));
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    b.launch = {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
      left: tier === "high" ? 0.36 : 0.18,
      tier,
    };
    const finisher = a.attackData?.finisher || a.motorMove?.finisher || a.combo === 3;
    if (heavy && !a.projectile && finisher && b.world !== "space")
      Physics.impulse(b, { z: 260 });
    else if (heavy && !a.projectile && a.heavyStrike && b.world !== "space")
      Physics.impulse(b, { z: 165 });
    const contact = a.attackData?.contact || Hitboxes.impactPoint(a, b);
    this.emit("impact", { ...b, x: contact.x, y: contact.y, z: contact.z }, { angle, tier, heavy, visualZ: contact.visualZ ?? Physics.height(b), part: contact.part || "torso" });
    if (tier === "high" && b.world !== "space") this.impactTerrain(b, tier);
  };
  Engine.prototype.tick = function (dt = 1 / 30) {
    const charged = this.shots.filter((s) => s.pierce && s.life <= dt);
    tick.call(this, dt);
    for (const shot of charged)
      if (shot.world !== "space") {
        this.impactTerrain(shot, "high");
        this.emit("impact", shot, { heavy: true, tier: "high" });
      }
    for (const e of this.enemies) {
      if (e.state !== "guard" && e.stun <= this.time)
        e.guardMeter = Math.min(70, (e.guardMeter ?? 70) + dt * 8);
    }
    for (const p of this.players.values()) {
      if (p.queuedAttack) {
        const q = p.queuedAttack;
        if (
          this.time > q.until ||
          p.stun > this.time ||
          p.state === "dead" ||
          p.input.guard
        ) {
          p.queuedAttack = null;
          continue;
        }
        if (p.cooldowns.attack <= this.time) {
          p.queuedAttack = null;
          p.heavyStrike = q.heavy && p.ki >= 18;
          if (p.heavyStrike) p.ki -= 18;
          act.call(this, p.id, "attack");
          p.heavyStrike = false;
        }
      }
    }
    for (const e of [...this.players.values(), ...this.enemies]) {
      if (!e.launch) continue;
      const l = e.launch,
        steps = Math.max(1, Math.ceil((Math.hypot(l.x, l.y) * dt) / 35));
      for (let i = 0; i < steps; i++) {
        this.move(e, (l.x * dt) / steps, (l.y * dt) / steps);
        if (l.tier !== "low" && e.world !== "space")
          this.impactTerrain(e, l.tier);
      }
      l.left -= dt;
      l.x *= Math.exp(-dt * 4);
      l.y *= Math.exp(-dt * 4);
      e.stun = Math.max(e.stun, this.time + 0.04);
      if (l.left <= 0) e.launch = null;
    }
  };
  Engine.prototype.impactTerrain = function (e, tier) {
    return;
    this.worldMemory ??= {};
    const airborneZ = Hitboxes.height(e);
    const lower = e.owner ? airborneZ - (e.r || 0) : airborneZ;
    const upper = e.owner ? airborneZ + (e.r || 0) : airborneZ + Hitboxes.body(e).height;
    const radius = e.owner ? e.r || 8 : Hitboxes.body(e).radius;
    const planeY = e.y + (e.owner ? e.visualOffset ?? Physics.body(e).height*.59 : 0);
    const cx = Math.floor(e.x / W.CHUNK),
      cy = Math.floor(e.y / W.CHUNK);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const o of W.features(e.world, cx + dx, cy + dy)) {
          if (o.kind === "mountain" && tier !== "high") continue;
          const touching = CollisionWorld.collidersFor(o, e.world).some(c => Physics.parts(c).some(part =>
            part.solid !== false && lower < (part.z || 0) + part.height - .4 &&
            upper > (part.z || 0) + .4 && Physics.contact(part, e.x, planeY, radius)));
          if (!touching)
            continue;
          const key = "debris:" + o.id;
          if (this.worldMemory[key]) continue;
          this.worldMemory[key] = {
            world: e.world,
            x: o.x,
            y: o.y,
            radius: o.radius,
            kind: o.kind,
          };
          this.emit(
            "break",
            { world: e.world, x: o.x, y: o.y },
            { text: "IMPACTO", heavy: true },
          );
        }
  };
  Engine.prototype.snapshot = function (id) {
    const s = snapshot.call(this, id);
    if (!s) return s;
    s.self.targetId = this.players.get(id).targetId;
    s.self.meleeCharge = Math.max(
      0,
      this.time - (this.players.get(id).meleeAt ?? this.time),
    );
    s.self.debris = Object.entries(this.worldMemory || {})
      .filter(
        ([k, o]) =>
          k.startsWith("debris:") &&
          o.world === s.self.world &&
          Math.hypot(o.x - s.self.x, o.y - s.self.y) < 2400,
      )
      .map(([id, o]) => ({ id: id.slice(7), ...o }));
    return s;
  };
};
