(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./physics"), require("./body-geometry"));
  else root.UZHitboxes = factory(root.UZPhysics, root.UZBodyGeometry);
})(globalThis, function (Physics, Geometry) {
  "use strict";
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
  const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const strikeCache = new Map();
  // x/y anchor the same overhead rig as the renderer; z is height of its feet.
  // Narrow phase uses the actual projected limbs, plus physical vertical overlap.
  // A tall vertical cylinder at the anchor would award hits beside the drawing.
  function body(e) { return Geometry.body(e); }
  function height(e) { return finite(Physics.height(e), finite(e?.z)); }
  function sameLayer(a, b, padding = 0) {
    if (!a || !b || a.world !== b.world) return false;
    const az = height(a), bz = height(b);
    return az <= bz + body(b).height + padding && bz <= az + body(a).height + padding;
  }
  function poseOf(e, move) {
    return move?.motion?.pose || move?.pose || e.moveAction?.motion?.pose ||
      e.combatAction?.motion?.pose || e.motorMove?.motion?.pose ||
      ((e.combo || e.motorMove?.stage) === 3 ? "roundhouse" : (e.combo || e.motorMove?.stage) === 2 ? "cross" : "jab");
  }
  function attackHeight(e, move) {
    const pose = poseOf(e, move), h = body(e).height;
    return height(e) + h * (/sweep|heelDrop/i.test(pose) ? .25 : /uppercut|risingKnee/i.test(pose) ? .57 : .59);
  }
  function poseEntity(e) {
    if (e.combo || !e.motorMove?.stage) return e;
    return { ...e, combo: e.motorMove.stage };
  }
  function hurtboxes(e) {
    const b = body(e), z = height(e), rig = Geometry.rigPose(poseEntity(e));
    const output = [];
    function ellipse(part, center, rx, ry, at, rz, localAngle = 0) {
      const p = rig.transform(center), c = Math.cos(localAngle), s = Math.sin(localAngle);
      const pu = rig.transform([center[0] + c * rx, center[1] + s * rx]);
      const pv = rig.transform([center[0] - s * ry, center[1] + c * ry]);
      output.push({ part, x: p.x, y: p.y, displayY: p.y - z, z: z + b.height * at,
        rx: Math.hypot(pu.x - p.x, pu.y - p.y), ry: Math.hypot(pv.x - p.x, pv.y - p.y),
        rz: b.height * rz, angle: Math.atan2(pu.y - p.y, pu.x - p.x) });
    }
    if (e.species) {
      const m = Geometry.body(e), angle = finite(e.angle), c = Math.cos(angle), s = Math.sin(angle);
      const volume = (part, x, y, rx, ry, at, rz) => ({ part,
        x: finite(e.x) + x * c - y * s, y: finite(e.y) + x * s + y * c,
        displayY: finite(e.y) + x * s + y * c - z, z: z + m.height * at, rx, ry, rz: m.height * rz, angle });
      return [volume("torso", -m.radius * .1, -m.height * .43, m.radius * .86, m.height * .29, .45, .35),
        volume("head", m.radius * .8, -m.height * .64, m.radius * .37, m.height * .18, .77, .2)];
    }
    if (Geometry.design(e).rig === "serpent") {
      for (let i = 0; i < 7; i++) ellipse(i === 0 ? "head" : "torso", [0, 14 - i * 9], i === 0 ? 10 : 5.5, 6, .5, .35);
      return output;
    }
    ellipse("torso", [0, -2], 13.8, 10.5, .52, .31);
    // The face is on the leading rim in ground mode and ahead of the shoulders
    // in flight. Hair spikes, aura, capes and equipment never enlarge a hurtbox.
    ellipse("head", [rig.hit ? rig.strikeSide * rig.punch * 1.5 : 0, rig.flight ? 15 : 5 + rig.tilt * 6],
      rig.flight ? 9.3 : 10.5, rig.flight ? 9 : 9.5 * (.67 + rig.tilt * .22), .83, .15);
    for (const limb of rig.limbs) {
      const at = limb.part === "legs" ? .21 : .52, rz = limb.part === "legs" ? .21 : .22;
      for (let i = 1; i < limb.points.length; i++) {
        const a = limb.points[i - 1], c = limb.points[i], dx = c[0] - a[0], dy = c[1] - a[1];
        ellipse(limb.part, [(a[0] + c[0]) * .5, (a[1] + c[1]) * .5],
          Math.hypot(dx, dy) * .5 + limb.width * .5, limb.width, at, rz, Math.atan2(dy, dx));
      }
      if (limb.part === "arms") ellipse("arms", limb.points[2], 3.8, 3.8, .53, .15);
    }
    return output;
  }
  // Segment against an oriented ellipse and its vertical extent. Positions here
  // are already in the drawing's projection, so projection never happens twice.
  function intersect(from, to, volume, radius) {
    const cos = Math.cos(volume.angle), sin = Math.sin(volume.angle);
    const transform = p => {
      const x = p.x - volume.x, y = p.y - volume.displayY;
      return { x: (x * cos + y * sin) / (volume.rx + radius),
        y: (-x * sin + y * cos) / (volume.ry + radius),
        z: (p.z - volume.z) / (volume.rz + radius) };
    };
    const a = transform(from), b = transform(to), dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const cc = a.x * a.x + a.y * a.y + a.z * a.z - 1;
    let fraction = 0;
    if (cc > 0) {
      const aa = dx * dx + dy * dy + dz * dz;
      if (aa < 1e-10) return false;
      const bb = a.x * dx + a.y * dy + a.z * dz, discriminant = bb * bb - aa * cc;
      if (discriminant < 0) return false;
      fraction = (-bb - Math.sqrt(discriminant)) / aa;
      if (fraction < 0 || fraction > 1) return false;
    }
    const p = { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction,
      z: from.z + (to.z - from.z) * fraction };
    const normal = transform(p), nx = normal.x / (volume.rx + radius), ny = normal.y / (volume.ry + radius), nz = normal.z / (volume.rz + radius);
    const length = Math.hypot(nx, ny, nz) || 1;
    return { ...p, part: volume.part, fraction,
      normal: { x: (nx * cos - ny * sin) / length, y: (nx * sin + ny * cos) / length, z: nz / length } };
  }
  function contactInWorld(contact, offset) {
    if (!contact) return false;
    const visualZ = contact.z - offset;
    return { ...contact, y: contact.y + visualZ, visualZ };
  }
  function projectileHit(shot, target, fromX = shot.x, fromY = shot.y) {
    if (!shot || !target || shot.world !== target.world) return false;
    const radius = Math.max(1, finite(shot.r, 8)), z = finite(shot.z, attackHeight(shot));
    const previousZ = finite(shot.previousZ, z), offset = finite(shot.visualOffset, body(shot).height * .59);
    if (Math.min(previousZ, z) - radius > height(target) + body(target).height ||
        Math.max(previousZ, z) + radius < height(target)) return false;
    const from = { x: finite(fromX), y: finite(fromY) - Math.max(0, previousZ - offset), z: previousZ };
    const to = { x: finite(shot.x), y: finite(shot.y) - Math.max(0, z - offset), z };
    // Avoid constructing all limb volumes for a shot far from the visible rig.
    const maxReach = Math.max(body(target).height, body(target).radius * 3) + radius;
    const dx = to.x - from.x, dy = to.y - from.y, length = dx * dx + dy * dy;
    const t = clamp(((target.x - from.x) * dx + (target.y - height(target) - from.y) * dy) / (length || 1), 0, 1);
    if (Math.hypot(from.x + dx * t - target.x, from.y + dy * t - (target.y - height(target))) > maxReach) return false;
    let contact = false;
    for (const volume of hurtboxes(target)) {
      const hit = intersect(from, to, volume, radius);
      if (hit && (!contact || hit.fraction < contact.fraction)) contact = hit;
    }
    return contactInWorld(contact, offset);
  }
  function localStrike(attacker, move) {
    const pose = poseOf(attacker, move), motion = { ...(move.motion || attacker.moveAction?.motion || attacker.motorMove?.motion), pose };
    const key = [attacker.skin, attacker.appearance?.body || "", attacker.boss ? 1 : 0,
      attacker.mode, pose, motion.side || 0, attacker.combo || attacker.motorMove?.stage || 1].join("|");
    if (strikeCache.has(key)) return strikeCache.get(key);
    const e = { ...poseEntity(attacker), x: 0, y: 0, z: 0, groundZ: 0, vz: 0,
      grounded: true, vx: 0, vy: 0, angle: 0, state: "attack" };
    const m = { ...move, key: move.key || "jab", motion }, paths = [];
    let prior;
    // The active sweep is the real fist/foot trajectory, with the rig's rotations
    // and body deformation. A configured acquisition range cannot lengthen it.
    for (const progress of [0, .25, .5, .75, 1]) {
      const rig = Geometry.rigPose(e, m, progress);
      const limb = rig.limbs.find(l => l.part === (rig.kick ? "legs" : "arms") && l.side === rig.strikeSide);
      if (!limb) continue;
      const local = rig.pose === "elbow" ? limb.points[1] : ["risingKnee", "airKnee"].includes(rig.pose) ? limb.points[1] : limb.points[2];
      const p = rig.transform(local), base = attackHeight(e, m);
      const physicalZ = base + (/uppercut|risingKnee/i.test(pose) ? (progress - .4) * body(e).height * .27 :
        /heelDrop|airDive|meteor/i.test(pose) ? (.5 - progress) * body(e).height * .17 : 0);
      const point = { x: p.x, y: p.y, z: physicalZ };
      if (prior) paths.push({ from: prior, to: point, radius: (rig.kick ? 4.3 : 3.8) * rig.scale,
        offset: physicalZ });
      prior = point;
    }
    let reach = body(e).radius;
    for (const path of paths) reach = Math.max(reach,
      Math.hypot(path.from.x, path.from.y) + path.radius, Math.hypot(path.to.x, path.to.y) + path.radius);
    const value = { paths, reach };
    if (strikeCache.size >= 384) strikeCache.delete(strikeCache.keys().next().value);
    strikeCache.set(key, value);
    return value;
  }
  function strikePaths(attacker, move, angle) {
    const a = finite(angle, finite(attacker.angle)), c = Math.cos(a), s = Math.sin(a), z = height(attacker);
    const project = p => ({ x: attacker.x + p.x * c - p.y * s,
      y: attacker.y - z + p.x * s + p.y * c, z: z + p.z });
    return localStrike(attacker, move).paths.map(path => ({ from: project(path.from), to: project(path.to), radius: path.radius }));
  }
  function meleeReach(attacker, move = {}) {
    return localStrike(attacker, move).reach;
  }
  function meleeHit(attacker, target, move = {}, angle = attacker.angle) {
    if (!attacker || !target || !sameLayer(attacker, target, 2)) return false;
    const reach = meleeReach(attacker, move), radius = body(target).radius;
    if (Math.hypot(target.x - attacker.x, target.y - height(target) - (attacker.y - height(attacker))) > reach + radius * 1.8) return false;
    let contact = false, offset = 0;
    const volumes = hurtboxes(target);
    for (const path of strikePaths(attacker, move, angle)) {
      for (const volume of volumes) {
        const hit = intersect(path.from, path.to, volume, path.radius);
        if (hit && (!contact || hit.fraction < contact.fraction)) { contact = hit; offset = hit.z - height(attacker); }
      }
    }
    return contactInWorld(contact, offset);
  }
  function contactHit(attacker, target, move = {}, angle = attacker.angle) {
    if (!attacker || !target || !sameLayer(attacker, target)) return false;
    const distance = Math.hypot(target.x - attacker.x, target.y - attacker.y);
    const contactDistance = body(attacker).radius + body(target).radius + 12;
    const direction = Math.atan2(target.y - attacker.y, target.x - attacker.x);
    const strikeZ = attackHeight(attacker, move), targetZ = height(target);
    // Small contact tolerance keeps a touching torso hittable when a hook or
    // elbow's drawn sweep passes around its edge. It never extends attack reach.
    if (distance > contactDistance || Math.cos(angleDelta(direction, angle)) <= .18 ||
      strikeZ < targetZ - 4 || strikeZ > targetZ + body(target).height + 4) return false;
    return impactPoint(attacker, target);
  }
  function guardArc(defender, attacker) {
    if (!defender || !attacker || defender.world !== attacker.world) return false;
    const impactZ = finite(attacker.attackData?.contact?.z, finite(attacker.impactZ,
      attacker.projectile ? finite(attacker.z, attackHeight(attacker)) : attackHeight(attacker, attacker.moveAction || attacker.motorMove)));
    const z = height(defender), h = body(defender).height;
    if (impactZ < z + h * .08 || impactZ > z + h * 1.04) return false;
    const direction = attacker.projectile && Number.isFinite(attacker.angle) ? attacker.angle + Math.PI :
      Math.atan2(attacker.y - defender.y, attacker.x - defender.x);
    return Math.cos(angleDelta(direction, finite(defender.angle))) > .24;
  }
  function impactPoint(a, b) {
    const volumes = hurtboxes(b), torso = volumes.find(v => v.part === "torso") || volumes[0];
    const angle = Math.atan2(a.y - b.y, a.x - b.x), r = body(b).radius * .6;
    return { world: b.world, x: torso.x + Math.cos(angle) * r, y: torso.y + Math.sin(angle) * r,
      z: torso.z, visualZ: height(b) };
  }
  return Object.freeze({ body, height, hurtboxes, sameLayer, attackHeight, meleeReach, meleeHit, contactHit, projectileHit, guardArc, impactPoint });
});
