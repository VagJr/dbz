"use strict";
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(
      require("../shared/movement"),
      require("../shared/content"),
      require("../shared/open-world"),
      require("../shared/physics"),
    );
  else root.UZRealtime = factory(root.UZMovement, root.UZ, root.UZOpenWorld, root.UZPhysics);
})(globalThis, (Movement, Content, World, Physics) => {
  class Presentation {
    constructor() {
      this.rtt = 0;
      this.frames = [];
      this.input = { x: 0, y: 0, angle: 0 };
      this.offset = { x: 0, y: 0, z: 0 };
      this.last = null;
      this.pending = null;
      this.hold = null;
      this.connected = true;
    }
    receive(state, now) {
      const old = this.predicted,
        p = state.self;
      const reset =
        !old ||
        old.id !== p.id ||
        old.world !== p.world ||
        p.state === "dead" ||
        Math.hypot(old.x - p.x, old.y - p.y) > 320;
      this.current = state;
      this.arrived = now;
      if (reset) {
        this.frames.length = 0;
        this.pending = null;
        this.hold = null;
        this.last = now;
      }
      if (p.stun > state.time || p.clash || p.roundLocked) this.hold = null;
      this.predicted = { ...p, stun: p.stun || 0 };
      Physics.ensure(this.predicted);
      if (!reset && this.connected && this.rtt < 600) {
        // Predict only a bounded one-way flight time; never alter HP/hit results.
        for (
          let ahead = 0, limit = Math.min(0.15, this.rtt / 2000);
          ahead < limit;
          ahead += 1 / 60
        )
          this.step(
            this.predicted,
            Math.min(1 / 60, limit - ahead),
            state.time + ahead,
          );
      }
      this.offset = reset
        ? { x: 0, y: 0, z: 0 }
        : {
            x: old.x + this.offset.x - this.predicted.x,
            y: old.y + this.offset.y - this.predicted.y,
            z: (old.z || 0) + (this.offset.z || 0) - this.predicted.z,
          };
      if (Math.hypot(this.offset.x, this.offset.y) > 160)
        this.offset = { x: 0, y: 0, z: 0 };
      const jumpCorrection = Math.max(72, Math.min(180,
        Math.max(Math.abs(old?.vz || 0), Math.abs(p.vz || 0)) * Math.max(.12, Math.min(.3, this.rtt / 1000))));
      this.offset.z = Math.max(-jumpCorrection, Math.min(jumpCorrection, this.offset.z));
      // An accepted landing must put the feet on the visible surface at once;
      // easing an old airborne offset would make the model hover after impact.
      if (this.predicted.grounded && this.predicted.mode !== "flight") this.offset.z = 0;
      this.frames.push({ state, at: now });
      if (this.frames.length > 6) this.frames.shift();
      if (
        this.pending &&
        (p.state === "dead" ||
          (p.combatAction && p.combatAction.start >= this.pending.move.start - 0.18) ||
          now - this.pending.at > (this.pending.queued ? 1500 : 350))
      )
        this.pending = null;
    }
    step(p, dt, t) {
      const cover = Physics.colliders(p.world, p.x, p.y,
        this.current?.self.physicsColliders || []);
      const debris = new Set((this.current?.self.debris || []).map(o => o.id));
      const colliders = debris.size ? cover.filter(o => !debris.has(o.id) && !debris.has(o.sourceId)) : cover;
      if (
        p.state === "dead" ||
        p.stun > t ||
        p.clash ||
        p.roundLocked ||
        p.launch
      ) {
        Physics.step(p, dt, colliders, { input: this.input, time: t });
        return;
      }
      const input = this.input;
      const locked =
        (p.combatAction && t < p.combatAction.end) ||
        (p.until > t && ["attack", "blast", "dash"].includes(p.state));
      p.moveAction =
        p.combatAction && t < p.combatAction.end ? p.combatAction : null;
      if (p.combatAction && t >= p.combatAction.end) p.combatAction = null;
      if (!locked) {
        p.angle = input.angle;
        p.state =
          input.guard && p.ki > 1
            ? "guard"
            : input.charge
              ? "charge"
              : this.hold?.state ||
                (Math.hypot(input.x, input.y) > 0.1
                  ? p.mode === "flight"
                    ? "fly"
                    : "run"
                  : p.mode === "flight"
                    ? "glide"
                    : "idle");
      }
      p.boosting = p.mode === "flight" && input.boost && p.ki > 0;
      const speed =
        Content.ORIGINS.find((o) => o.id === p.origin)?.speed || 220;
      Movement.velocity(p, input, dt, t, speed);
      const heavy =
        p.lore &&
        !p.lore.bubbles &&
        p.world === "otherworld" &&
        Math.hypot(p.x - 16000, p.y - 1740) < 300;
      const dx = p.vx * dt * (heavy ? 0.65 : 1),
        dy = p.vy * dt * (heavy ? 0.65 : 1);
      Physics.move(p, dx, dy, colliders);
      Physics.step(p, dt, colliders, { input, time: t, gravityScale: heavy ? 1.6 : 1 });
    }
    sample(now) {
      if (!this.current) return null;
      const elapsed = Math.max(
        0,
        Math.min(0.05, this.last == null ? 0 : now - this.last),
      );
      this.last = now;
      const age = now - this.arrived;
      if (this.connected && age < 0.25)
        this.step(this.predicted, elapsed, this.current.time + age);
      const fade = Math.exp(-22 * elapsed);
      this.offset.x *= fade;
      this.offset.y *= fade;
      this.offset.z *= Math.exp(-12 * elapsed);
      const self = {
        ...this.current.self,
        ...this.predicted,
        x: this.predicted.x + this.offset.x,
        y: this.predicted.y + this.offset.y,
        z: Math.max(this.predicted.groundZ || 0, this.predicted.z + this.offset.z),
      };
      const serverNow = this.current.time + Math.max(0, now - this.arrived) / 1000;
      if (
        this.pending && now - this.pending.at < (this.pending.queued ? 1500 : 350) &&
        serverNow >= this.pending.move.start &&
        (!self.combatAction || serverNow >= self.combatAction.end)
      ) {
        self.combatAction = this.pending.move;
        self.state = "attack";
      }
      // Remote actors interpolate between snapshots. No extrapolation of hits.
      const target = now - 0.07;
      let a = this.frames[0],
        b = a;
      for (const frame of this.frames) {
        if (frame.at <= target) a = frame;
        if (frame.at >= target) {
          b = frame;
          break;
        }
        b = frame;
      }
      const ratio =
        a === b ? 1 : Math.max(0, Math.min(1, (target - a.at) / (b.at - a.at)));
      const interpolate = (list = [], before = []) => {
        const old = new Map(before.map((e) => [e.id, e]));
        return list.map((e) => {
          if (e.id === self.id) return self;
          const prev = old.get(e.id);
          if (!prev || Math.hypot(prev.x - e.x, prev.y - e.y) > 320) return e;
          return {
            ...e,
            x: prev.x + (e.x - prev.x) * ratio,
            y: prev.y + (e.y - prev.y) * ratio,
            z: (prev.z || 0) + ((e.z || 0) - (prev.z || 0)) * ratio,
            vz: (prev.vz || 0) + ((e.vz || 0) - (prev.vz || 0)) * ratio,
            groundZ: (prev.groundZ || 0) + ((e.groundZ || 0) - (prev.groundZ || 0)) * ratio,
          };
        });
      };
      return {
        ...this.current,
        self,
        enemies: interpolate(b.state.enemies, a.state.enemies),
        players: interpolate(b.state.players, a.state.players),
        npcs: interpolate(b.state.npcs, a.state.npcs),
        wildlife: interpolate(b.state.wildlife, a.state.wildlife),
        presentation: true,
      };
    }
    intent(action, now, moves) {
      if (action === "jump" && this.predicted && this.current) {
        if (this.predicted.state !== "dead" && this.predicted.stun <= this.current.time &&
            !this.predicted.clash && !this.predicted.roundLocked && !this.predicted.combatAction) Physics.jump(this.predicted);
        return;
      }
      const held = this.hold ? (now - this.hold.at) / 1000 : 0;
      if (["cancelCharge", "attackRelease", "blast"].includes(action))
        this.hold = null;
      if (!this.current) return;
      const self = this.current.self;
      const serverNow = this.current.time + Math.max(0, now - this.arrived) / 1000;
      const currentMove = self.combatAction;
      const queueRoom = !self.queuedAction || (self.queuedAction.count || 1) < 2;
      const canQueue = !!currentMove && queueRoom &&
        (["jab", "link", "finisher"].includes(currentMove.key) ||
          currentMove.end - serverNow <= 0.18 ||
          (currentMove.confirmed && ["jab", "link"].includes(currentMove.key)));
      if (
        self.stun > serverNow || self.state === "dead" || self.roundLocked ||
        (currentMove && !canQueue)
      )
        return;
      if (action === "attackStart" || action === "blastStart") {
        if (
          action === "blastStart" &&
          self.cooldowns.blast > serverNow
        )
          return;
        this.hold = {
          state: action === "blastStart" ? "chargeAim" : "meleeCharge",
          at: now,
        };
        return;
      }
      if (action !== "attackRelease" && action !== "blast") return;
      if (
        action === "blast" &&
        self.cooldowns.blast > serverNow
      )
        return;
      const combo = self.comboConfirmed || 0;
      const key =
          action === "blast"
            ? held >= 0.55
              ? "charged"
              : combo === 2
                ? "weave"
                : "ki"
            : held >= 0.45
              ? "heavy"
              : combo === 1
                ? "link"
                : combo === 2
                  ? "finisher"
                  : "jab",
        m = moves[key];
      const time = Math.max(serverNow, currentMove?.end || 0);
      this.pending = {
        at: now,
        queued: canQueue,
        move: {
          key,
          name: m.name,
          start: time,
          impact: time + m.startup,
          activeEnd: time + m.startup + m.active,
          end: time + m.startup + m.active + m.recovery,
        },
      };
    }
    rejectIntent(action, requestedAt) {
      if (this.pending && Math.abs(this.pending.at - requestedAt) < 2)
        this.pending = null;
      if ((action === "attackStart" || action === "blastStart") &&
          this.hold && Math.abs(this.hold.at - requestedAt) < 2)
        this.hold = null;
    }
  }
  return { Presentation };
});
