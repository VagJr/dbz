"use strict";
const W = require("../shared/open-world");
const cache = new Map();
function obstacles(world, x, y) {
  const cx = Math.floor(x / W.CHUNK),
    cy = Math.floor(y / W.CHUNK),
    out = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      const key = world + ":" + (cx + dx) + ":" + (cy + dy);
      if (!cache.has(key)) {
        cache.set(
          key,
          W.features(world, cx + dx, cy + dy).filter(
            (o) =>
              o.kind === "mountain" ||
              (o.kind === "prop" &&
                (o.sheet === "nature" || (o.sprite >= 126 && o.sprite <= 167))),
          ),
        );
        if (cache.size > 256) cache.delete(cache.keys().next().value);
      }
      out.push(...cache.get(key));
    }
  return out;
}
function collision(engine, e, x, y, pad = 16) {
  if (e.world === "space" || e.mode === "flight") return false;
  return obstacles(e.world, x, y).some(
    (o) =>
      !engine.worldMemory?.["debris:" + o.id] &&
      Math.hypot(x - o.x, (y - o.y) * 1.45) < o.radius * 0.76 + pad,
  );
}
function sight(engine, a, b) {
  if (a.world !== b.world) return false;
  if (a.world === "space" || a.mode === "flight" || b.mode === "flight")
    return true;
  const dx = b.x - a.x,
    dy = (b.y - a.y) * 1.45,
    len = dx * dx + dy * dy;
  if (len < 1) return true;
  return !obstacles(a.world, (a.x + b.x) / 2, (a.y + b.y) / 2).some((o) => {
    if (engine.worldMemory?.["debris:" + o.id]) return false;
    const f = Math.max(
      0,
      Math.min(1, ((o.x - a.x) * dx + (o.y - a.y) * 1.45 * dy) / len),
    );
    return (
      f > 0.03 &&
      f < 0.97 &&
      Math.hypot(a.x + dx * f - o.x, a.y * 1.45 + dy * f - o.y * 1.45) <
        o.radius * 0.76
    );
  });
}
module.exports = (Engine) => {
  const move = Engine.prototype.move;
  Engine.prototype.clearSight = function (a, b) {
    return sight(this, a, b);
  };
  Engine.prototype.move = function (e, dx, dy) {
    if (e.mode === "flight" || e.world === "space")
      return move.call(this, e, dx, dy);
    const n = Math.min(160, Math.max(1, Math.ceil(Math.hypot(dx, dy) / 22)));
    for (let i = 0; i < n; i++) {
      const nx = e.x + dx / n,
        ny = e.y + dy / n;
      if (!collision(this, e, nx, ny)) move.call(this, e, dx / n, dy / n);
      else {
        if (!collision(this, e, nx, e.y)) move.call(this, e, dx / n, 0);
        if (!collision(this, e, e.x, ny)) move.call(this, e, 0, dy / n);
      }
    }
  };
  Engine.prototype.tacticalStep = function (e, target, desired, dt, speed) {
    const strength = Math.min(1, Math.hypot(desired.x, desired.y));
    if (strength < 0.04) return;
    speed *= strength;
    const look = 75;
    const angle = Math.atan2(desired.y, desired.x);
    for (const offset of [
      0,
      e.ai?.orbit * 0.55 || 0.55,
      -(e.ai?.orbit * 0.55 || 0.55),
      1.2,
      -1.2,
      Math.PI / 2,
      -Math.PI / 2,
    ]) {
      const a = angle + offset,
        x = Math.cos(a),
        y = Math.sin(a);
      if (!collision(this, e, e.x + x * look, e.y + y * look)) {
        this.move(e, x * dt * speed, y * dt * speed);
        return;
      }
    }
  };
};
module.exports.collision = collision;
module.exports.sight = sight;
