(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UZMovement = api;
})(globalThis, () => {
  // The browser and the authority use the same velocity step. Position,
  // collision, resources and damage are still validated by the server.
  function velocity(p, input, dt, t, originSpeed, stale = false) {
    const locked =
      !!p.moveAction ||
      !!p.roundLocked ||
      (p.until > t && ["attack", "blast", "dash"].includes(p.state));
    const basic =
      p.moveAction && ["jab", "link", "finisher"].includes(p.moveAction.key);
    const airborne = p.mode === "flight";
    const accelerating =
      (!locked || basic) && p.stun <= t && !input.guard && !input.charge;
    const intensity = basic
      ? 0.72
      : p.state === "chargeAim"
        ? 1
        : p.state === "charge"
          ? 0.2
          : p.state === "guard"
            ? 0.28
            : 1;
    if (accelerating && Math.hypot(input.x, input.y) > 0.08) {
      const acceleration =
        p.world === "space"
          ? 7600
          : airborne
            ? p.boosting
              ? 6200
              : 5400
            : 2400;
      const n = Math.hypot(input.x, input.y),
        ux = input.x / n,
        uy = input.y / n;
      const lateral = (-p.vx * uy + p.vy * ux) * (1 - Math.exp(-12 * dt));
      p.vx += lateral * uy + input.x * acceleration * intensity * dt;
      p.vy += -lateral * ux + input.y * acceleration * intensity * dt;
    } else {
      const drag = stale
        ? 18
        : locked && p.state === "dash"
          ? 0.4
          : airborne
            ? accelerating
              ? 3.8
              : 9
            : 12;
      p.vx *= Math.exp(-drag * dt);
      p.vy *= Math.exp(-drag * dt);
    }
    let maxSpeed =
      locked && p.state === "dash"
        ? 1600
        : p.world === "space"
          ? p.boosting
            ? 4200
            : 2100
          : airborne
            ? (p.boosting ? 1450 : p.form ? 1120 : 920) * intensity
            : (originSpeed * 1.18 + (p.stats?.force || 0) * 3) * intensity;
    if (p.duelId || t - (p.lastCombatAt ?? -99) < 5)
      maxSpeed = Math.min(
        maxSpeed,
        p.state === "dash" ? 680 : airborne ? 360 : 300,
      );
    if (p.roundLocked) maxSpeed = 0;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > maxSpeed) {
      p.vx *= maxSpeed / speed;
      p.vy *= maxSpeed / speed;
    }
    if (Math.hypot(p.vx, p.vy) < 0.1) p.vx = p.vy = 0;
    return p;
  }
  return { velocity };
});
