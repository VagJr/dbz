(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UZMovement = api;
})(globalThis, () => {
  const flight = Object.freeze({
    cruise: 460, transformed: 540, boost: 680,
    acceleration: 2600, boostAcceleration: 3100,
    brake: 14, steering: 20, reverseBrake: 18,
    spaceCruise: 1500, spaceBoost: 2500, spaceAcceleration: 4400,
  });
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
    const weight = Math.sqrt(Math.max(.7, (p.mass || 80) / 80));
    const airControl = p.mode !== "flight" && p.grounded === false ? .62 : 1;
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
      const acceleration = (
        p.world === "space"
          ? flight.spaceAcceleration
          : airborne
            ? p.boosting
              ? flight.boostAcceleration
              : flight.acceleration
            : 2400) * airControl / weight;
      const n = Math.hypot(input.x, input.y),
        ux = input.x / n,
        uy = input.y / n;
      // Remove sideways drift quickly; reversing must not require a wide arc.
      if (airborne && p.vx * ux + p.vy * uy < 0) {
        const reverse = Math.exp(-flight.reverseBrake * dt);
        p.vx *= reverse;
        p.vy *= reverse;
      }
      const lateral = (-p.vx * uy + p.vy * ux) *
        (1 - Math.exp(-(airborne ? flight.steering : 12) * airControl * dt / weight));
      p.vx += lateral * uy + input.x * acceleration * intensity * dt;
      p.vy += -lateral * ux + input.y * acceleration * intensity * dt;
    } else {
      const drag = stale
        ? 18
        : locked && p.state === "dash"
          ? 0.4
          : airborne
            ? accelerating
              ? flight.brake
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
            ? flight.spaceBoost
            : flight.spaceCruise
          : airborne
            ? (p.boosting ? flight.boost : p.form ? flight.transformed : flight.cruise) * intensity
            : (originSpeed * 1.18 + (p.stats?.force || 0) * 3) * intensity;
    if (p.duelId || t - (p.lastCombatAt ?? -99) < 5)
      maxSpeed = Math.min(
        maxSpeed,
        p.state === "dash" ? 680 : airborne ? p.boosting ? 360 : 300 : 300,
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
  return { velocity, flight };
});
