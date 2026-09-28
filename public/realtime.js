"use strict";
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(
      require("../shared/movement"),
      require("../shared/content"),
      require("../shared/open-world"),
    );
  else root.UZRealtime = factory(root.UZMovement, root.UZ, root.UZOpenWorld);
})(globalThis, (Movement, Content, World) => {
  const terrain = new Map(),
    maps = new Map();
  function obstacles(p) {
    const cx = Math.floor(p.x / World.CHUNK),
      cy = Math.floor(p.y / World.CHUNK),
      out = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${p.world}:${cx + dx}:${cy + dy}`;
        if (!terrain.has(key)) {
          terrain.set(
            key,
            World.features(p.world, cx + dx, cy + dy).filter(
              (o) =>
                o.kind === "mountain" ||
                (o.kind === "prop" &&
                  (o.sheet === "nature" ||
                    (o.sprite >= 126 && o.sprite <= 167))),
            ),
          );
          if (terrain.size > 64) terrain.delete(terrain.keys().next().value);
        }
        out.push(...terrain.get(key));
      }
    return out;
  }
  class Presentation {
    constructor() {
      this.rtt = 0;
      this.frames = [];
      this.input = { x: 0, y: 0, angle: 0 };
      this.offset = { x: 0, y: 0 };
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
        ? { x: 0, y: 0 }
        : {
            x: old.x + this.offset.x - this.predicted.x,
            y: old.y + this.offset.y - this.predicted.y,
          };
      if (Math.hypot(this.offset.x, this.offset.y) > 160)
        this.offset = { x: 0, y: 0 };
      this.frames.push({ state, at: now });
      if (this.frames.length > 6) this.frames.shift();
      if (
        this.pending &&
        (p.combatAction || p.state === "dead" || now - this.pending.at > 0.35)
      )
        this.pending = null;
    }
    step(p, dt, t) {
      if (
        p.state === "dead" ||
        p.stun > t ||
        p.clash ||
        p.roundLocked ||
        p.launch
      )
        return;
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
      if (p.mode === "flight" || p.world === "space") {
        p.x += dx;
        p.y += dy;
        return;
      }
      if (!maps.has(p.world)) maps.set(p.world, Content.worldData(p.world));
      if (maps.size > 32) maps.delete(maps.keys().next().value);
      const cover = obstacles(p),
        debris = new Set((this.current.self.debris || []).map((o) => o.id));
      const blocked = (x, y) =>
        cover.some(
          (o) =>
            !debris.has(o.id) &&
            Math.hypot(x - o.x, (y - o.y) * 1.45) < o.radius * 0.76 + 16,
        );
      const move = (x, y) => {
        for (const b of maps.get(p.world).buildings)
          if (Math.abs(x - b.x) < 70 && Math.abs(y - b.y) < 60) {
            if (Math.abs(p.x - b.x) >= 70) x = p.x;
            else y = p.y;
          }
        p.x = Math.max(-1e8, Math.min(1e8, x));
        p.y = Math.max(-1e8, Math.min(1e8, y));
      };
      const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 22));
      for (let i = 0; i < n; i++) {
        const x = p.x + dx / n,
          y = p.y + dy / n;
        if (!blocked(x, y)) move(x, y);
        else {
          if (!blocked(x, p.y)) move(x, p.y);
          if (!blocked(p.x, y)) move(p.x, y);
        }
      }
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
      const self = {
        ...this.current.self,
        ...this.predicted,
        x: this.predicted.x + this.offset.x,
        y: this.predicted.y + this.offset.y,
      };
      if (this.pending && now - this.pending.at < 0.25 && !self.combatAction) {
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
      const interpolate = (list, before) => {
        const old = new Map(before.map((e) => [e.id, e]));
        return list.map((e) => {
          if (e.id === self.id) return self;
          const prev = old.get(e.id);
          if (!prev || Math.hypot(prev.x - e.x, prev.y - e.y) > 320) return e;
          return {
            ...e,
            x: prev.x + (e.x - prev.x) * ratio,
            y: prev.y + (e.y - prev.y) * ratio,
          };
        });
      };
      return {
        ...this.current,
        self,
        enemies: interpolate(b.state.enemies, a.state.enemies),
        players: interpolate(b.state.players, a.state.players),
        presentation: true,
      };
    }
    intent(action, now, moves) {
      const held = this.hold ? now - this.hold.at : 0;
      if (["cancelCharge", "attackRelease", "blast"].includes(action))
        this.hold = null;
      if (
        !this.current ||
        this.current.self.stun > this.current.time ||
        this.current.self.state === "dead" ||
        this.current.self.combatAction ||
        this.current.self.roundLocked
      )
        return;
      if (action === "attackStart" || action === "blastStart") {
        if (
          action === "blastStart" &&
          this.current.self.cooldowns.blast > this.current.time
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
        this.current.self.cooldowns.blast > this.current.time
      )
        return;
      const combo = this.current.self.comboConfirmed || 0;
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
      const time = this.current.time + Math.max(0, now - this.arrived);
      this.pending = {
        at: now,
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
  }
  return { Presentation };
});
