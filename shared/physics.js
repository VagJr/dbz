(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./collision-world"), require("./body-geometry"));
  else root.UZPhysics = factory(root.UZCollisionWorld, root.UZBodyGeometry);
})(globalThis, (World, Bodies) => {
  "use strict";
  const GRAVITY = 1250, JUMP_HEIGHT = 70, JUMP_WINDUP = .055, STEP_HEIGHT = 8, FLIGHT_HEIGHT = 36;
  const shapes = new WeakMap(), sections = new WeakMap(), supports = new WeakMap();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function body(e) {
    if (Bodies?.body) return Bodies.body(e);
    if (e.kind === "stone") return { radius: e.size || 4, height: (e.size || 4) * 2, mass: 6 };
    if (e.species) {
      const animal = String(e.species);
      if (/saur/.test(animal)) return { radius: 20, height: 34, mass: 70 };
      if (/bird/.test(animal)) return { radius: 9, height: 22, mass: 4 };
      if (/fin/.test(animal)) return { radius: 9, height: 18, mass: 8 };
      if (/frog|hopper/.test(animal)) return { radius: 9, height: 18, mass: 4 };
      return { radius: 13, height: 22, mass: 16 };
    }
    const identity = String(e.skin || e.species || "").toLowerCase();
    const giant = /ozaru|oozaru|giant|greatape|dinosaur/.test(identity);
    const small = /krillin|gohanKid|goten|chiaotzu|kid|rabbit|frog|bird|fish/i.test(identity);
    const heavy = /broly|nappa|buu|dodoria|recoome/.test(identity);
    return {
      radius: giant ? 38 : small ? 14 : heavy ? 22 : 18,
      height: giant ? 138 : small ? 50 : heavy ? 74 : 64,
      mass: giant ? 340 : small ? 55 : heavy ? 120 : 80,
    };
  }
  function height(e) {
    return Number.isFinite(e.z) ? Math.max(0, e.z) : e.world === "space" ? 0 : e.mode === "flight" ? FLIGHT_HEIGHT : 0;
  }
  function displayHeight(e) {
    if (Number.isFinite(e.visualZ)) return e.visualZ;
    return e.owner ? Math.max(0, height(e) - (e.visualOffset ?? body(e).height * .59)) : height(e);
  }
  function ensure(e) {
    if (!Number.isFinite(e.z)) e.z = height(e);
    if (!Number.isFinite(e.vz)) e.vz = 0;
    if (!Number.isFinite(e.vx)) e.vx = 0;
    if (!Number.isFinite(e.vy)) e.vy = 0;
    if (!Number.isFinite(e.groundZ)) e.groundZ = 0;
    if (!Number.isFinite(e.jumpWindup)) e.jumpWindup = 0;
    if (typeof e.grounded !== "boolean") e.grounded = e.mode !== "flight" && e.z <= e.groundZ + .5;
    if (!Number.isFinite(e.mass)) e.mass = body(e).mass;
    return e;
  }
  function polygon(c) {
    if (shapes.has(c)) return shapes.get(c);
    let points = c.points;
    if (!points?.length) {
      const rx = c.rx || c.radius || 1, ry = c.ry || c.radius || rx;
      points = c.shape === "box" ? [[-rx,-ry],[rx,-ry],[rx,ry],[-rx,ry]] :
        Array.from({ length: 24 }, (_, i) => [Math.cos(i * Math.PI / 12) * rx, Math.sin(i * Math.PI / 12) * ry]);
    }
    shapes.set(c, points);
    return points;
  }
  // Render-authored horizontal slices replace an oversized vertical prism.
  // Slice points keep the same world anchor as the sprite's visible base.
  function parts(c) {
    let list = sections.get(c);
    if (!list) {
      list = !c.sections?.length ? [c] : c.sections.map(s => ({ ...c, ...s, sections: null,
        x: c.x + (s.x || 0), y: c.y + (s.y || 0),
        z: (c.z || 0) + s.minZ, height: Math.max(.01, s.maxZ - s.minZ), parent: c }));
      sections.set(c, list);
    }
    return list;
  }
  function supportShape(c) {
    if (!c.surfaceShape) return c;
    let shape = supports.get(c);
    if (!shape) {
      shape = { ...c, ...c.surfaceShape, x: c.x + (c.surfaceShape.x || 0),
        y: c.y + (c.surfaceShape.y || 0) };
      supports.set(c, shape);
    }
    return shape;
  }
  function contact(c, x, y, radius = 0) {
    const px = x - c.x, py = y - c.y;
    if (Math.abs(px) > (c.rx || c.radius || 1) + radius + 1 ||
        Math.abs(py) > (c.ry || c.radius || c.rx || 1) + radius + 1) return null;
    const points = polygon(c);
    let inside = false, best = Infinity, qx = 0, qy = 0;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [ax, ay] = points[j], [bx, by] = points[i];
      if ((ay > py) !== (by > py) && px < (bx - ax) * (py - ay) / (by - ay) + ax) inside = !inside;
      const dx = bx - ax, dy = by - ay;
      const f = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const ex = ax + f * dx, ey = ay + f * dy, d = (px - ex) ** 2 + (py - ey) ** 2;
      if (d < best) { best = d; qx = ex; qy = ey; }
    }
    const distance = Math.sqrt(best);
    if (!inside && distance >= radius) return null;
    const sign = inside ? -1 : 1;
    let nx = (px - qx) * sign, ny = (py - qy) * sign;
    const length = Math.hypot(nx, ny);
    if (length < .00001) { nx = 1; ny = 0; }
    else { nx /= length; ny /= length; }
    return { x: nx, y: ny, depth: inside ? radius + distance : radius - distance, inside };
  }
  function colliders(world, x, y, extra = []) {
    // Scene geometry is visual only. Keep gravity, bodies and combat hitboxes.
    return [];
  }
  function surface(e, list, x = e.x, y = e.y, ceiling = height(e) + STEP_HEIGHT) {
    let floor = 0;
    for (const c of list) {
      const top = (c.z || 0) + c.height;
      if (c.solid !== false && c.surface && top <= ceiling + .5 && top > floor && contact(supportShape(c), x, y, 0)) floor = top;
    }
    return floor;
  }
  function blocks(e, c) {
    if (c.solid === false) return false;
    const z = height(e), top = (c.z || 0) + (c.height || 0);
    // Locomotion is anchored to the feet, not the entire painted sprite.
    // Explicit overhead lintels also test head clearance.
    const clearance = c.ceiling ? body(e).height : Math.min(8, body(e).height);
    if (z >= top - .05 || z + clearance <= (c.z || 0) + .05) return false;
    const stepTop = c.parent ? (c.parent.z || 0) + c.parent.height : top;
    if (c.surface && e.mode !== "flight" && e.grounded && stepTop - z <= STEP_HEIGHT) return false;
    return true;
  }
  function blocked(e, x, y, list, radius = body(e).radius) {
    return list.some((c) => parts(c).some(p => blocks(e, p) && contact(p, x, y, radius)));
  }
  function move(e, dx, dy, list = colliders(e.world, e.x, e.y), options = {}) {
    ensure(e);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return e;
    if (e.world === "space") { e.x += dx; e.y += dy; return e; }
    const radius = options.radius || body(e).radius;
    const steps = Math.min(128, Math.max(1, Math.ceil(Math.hypot(dx, dy) / Math.max(7, radius * .55))));
    let collided = false;
    for (let i = 0; i < steps; i++) {
      let x = e.x + dx / steps, y = e.y + dy / steps;
      for (let pass = 0; pass < 3; pass++) {
        let fixed = false;
        for (const c of list) {
          for (const part of parts(c)) {
            if (!blocks(e, part)) continue;
            const hit = contact(part, x, y, radius);
            if (!hit) continue;
            x += hit.x * (hit.depth + .025); y += hit.y * (hit.depth + .025);
            const normalSpeed = e.vx * hit.x + e.vy * hit.y;
            if (normalSpeed < 0) { e.vx -= normalSpeed * hit.x; e.vy -= normalSpeed * hit.y; }
            e.contactNormal = { x: hit.x, y: hit.y };
            e.collisionId = c.id;
            collided = fixed = true;
          }
        }
        if (!fixed) break;
      }
      e.x = clamp(x, -1e8, 1e8); e.y = clamp(y, -1e8, 1e8);
      if (e.grounded && e.mode !== "flight") {
        const floor = surface(e, list);
        if (floor >= e.z - .5) e.z = e.groundZ = floor;
        else e.grounded = false;
      }
    }
    if (!collided) e.contactNormal = null;
    return e;
  }
  function jump(e) {
    ensure(e);
    if (e.world === "space" || e.mode === "flight" || !e.grounded || e.jumpWindup > 0 || e.state === "dead") return false;
    e.jumpWindup = JUMP_WINDUP;
    e.jumpStarted = true;
    return true;
  }
  function takeoff(e) {
    ensure(e);
    e.jumpWindup = 0;
    e.forcedFall = false;
    e.mode = "flight"; e.grounded = false;
    e.flightZ = FLIGHT_HEIGHT;
    e.vz = 0;
    return e;
  }
  function land(e) {
    ensure(e);
    e.mode = "ground"; e.flightZ = null; e.grounded = false;
    e.vz = Math.min(e.vz, 0);
    return e;
  }
  function impulse(e, force) {
    ensure(e);
    const weight = clamp(Math.sqrt(80 / body(e).mass), .45, 1.3);
    e.vx += (force.x || 0) * weight; e.vy += (force.y || 0) * weight;
    if (force.z && e.mode !== "flight") { e.vz += force.z * weight; e.grounded = false; e.forcedFall = true; }
    return e;
  }
  function step(e, dt, list = colliders(e.world, e.x, e.y), options = {}) {
    ensure(e);
    dt = clamp(Number(dt) || 0, 0, .1);
    if (!dt) return e;
    if (e.world === "space") { e.z = e.groundZ = e.vz = 0; e.grounded = false; return e; }
    if (e.jumpWindup > 0) {
      if (e.mode === "flight" || e.state === "dead") e.jumpWindup = 0;
      else {
        const wait = Math.min(dt, e.jumpWindup);
        e.jumpWindup = Math.max(0, e.jumpWindup - wait);
        dt -= wait;
        if (e.jumpWindup > 0) return e;
        const weight = clamp(Math.sqrt(80 / body(e).mass), .94, 1.06);
        e.vz = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT) * weight;
        e.grounded = false;
        if (dt <= 0) return e;
      }
    }
    const before = e.z, wasGrounded = e.grounded, input = options.input || e.input || {};
    const flight = e.mode === "flight" && !e.forcedFall && e.state !== "dead";
    if (flight) {
      e.grounded = false;
      // One combat plane for all flying fighters: no vertical flight input.
      e.flightZ = FLIGHT_HEIGHT;
      const locked = e.clashId || e.clash || e.roundLocked;
      if (locked) e.vz = 0;
      const desired = locked ? 0 : clamp((e.flightZ - e.z) * 12, -300, 220);
      e.vz += (desired - e.vz) * (1 - Math.exp(-12 * dt));
    } else if (!e.grounded || e.z > e.groundZ + .5) {
      e.vz -= GRAVITY * (options.gravityScale || 1) * dt;
    } else e.vz = 0;
    e.z = Math.max(0, e.z + e.vz * dt);
    if (e.vz > 0) {
      const h = body(e).height;
      for (const c of list) for (const part of parts(c)) {
        if (!part.ceiling || part.solid === false || before + h > part.z + .5 || e.z + h < part.z) continue;
        if (!contact(part, e.x, e.y, body(e).radius)) continue;
        e.z = Math.max(0, part.z - h); e.vz = 0;
        if (flight) e.flightZ = e.z;
      }
    }
    const floor = surface(e, list, e.x, e.y, Math.max(before, e.z) + (wasGrounded ? STEP_HEIGHT : .5));
    e.groundZ = floor;
    if (e.vz <= 0 && e.z <= floor + .5) {
      const impact = Math.max(0, -e.vz);
      e.z = floor; e.vz = 0; e.forcedFall = false;
      e.grounded = !flight;
      if (!wasGrounded && !flight) {
        e.landedAt = options.time ?? 0;
        e.landingSpeed = impact;
        e.vx *= .86; e.vy *= .86;
      }
      if (flight && e.flightZ < floor) e.flightZ = floor;
    } else e.grounded = false;
    // A falling body cannot settle inside the side of a mountain or building.
    if (blocked(e, e.x, e.y, list)) move(e, 0, 0, list);
    return e;
  }
  function trace(a, b, list, radius = 0) {
    // Fighters use an overhead rig while scenery is drawn in elevation.
    // Translate the projectile's torso offset into the world's elevation plane
    // before tracing, then return its original render anchor after contact.
    const offsetB = b.visualOffset ?? (b.owner || b.projectile ? body(b).height * .59 : 0);
    const offsetA = a.visualOffset ?? (a.owner || a.projectile ? body(a).height * .59 : offsetB);
    a = { ...a, y: a.y + offsetA }; b = { ...b, y: b.y + offsetB };
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
    const za = a.z || 0, zb = b.z || 0;
    let first = null;
    for (const original of list) for (const c of parts(original)) {
      if (c.solid === false) continue;
      if (Math.min(a.x,b.x) > c.x+c.rx+radius || Math.max(a.x,b.x) < c.x-c.rx-radius ||
          Math.min(a.y,b.y) > c.y+c.ry+radius || Math.max(a.y,b.y) < c.y-c.ry-radius) continue;
      const low = (c.z || 0) - radius, high = (c.z || 0) + c.height + radius;
      if (Math.min(za,zb) > high || Math.max(za,zb) < low) continue;
      const points = polygon(c), fractions = [0,1];
      if (za !== zb) fractions.push((low - za) / (zb - za), (high - za) / (zb - za));
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const ax = c.x + points[j][0], ay = c.y + points[j][1];
        const ex = points[i][0] - points[j][0], ey = points[i][1] - points[j][1];
        const edgeLength = Math.hypot(ex,ey) || 1, nx = -ey / edgeLength, ny = ex / edgeLength;
        const denominator = dx * nx + dy * ny;
        if (Math.abs(denominator) > .00001) {
          const distance = (a.x - ax) * nx + (a.y - ay) * ny;
          for (const offset of [-radius, radius]) {
            const t = (offset - distance) / denominator;
            const u = ((a.x + dx * t - ax) * ex + (a.y + dy * t - ay) * ey) / (edgeLength * edgeLength);
            if (t >= 0 && t <= 1 && u >= 0 && u <= 1) fractions.push(t);
          }
        }
        if (radius && length) {
          const px = a.x - ax, py = a.y - ay, bb = px * dx + py * dy;
          const cc = px * px + py * py - radius * radius, aa = length * length;
          const discriminant = bb * bb - aa * cc;
          if (discriminant >= 0) fractions.push((-bb - Math.sqrt(discriminant)) / aa);
        }
      }
      fractions.sort((x, y) => x - y);
      for (const fraction of fractions) {
        if (fraction < 0 || fraction > 1 || first && fraction >= first.fraction) continue;
        const x = a.x + dx * fraction, y = a.y + dy * fraction, z = za + (zb - za) * fraction;
        if (z < low || z > high || !contact(c,x,y,radius + .05)) continue;
        const offset = offsetA + (offsetB - offsetA) * fraction;
        first = { x, y: y - offset, z, visualZ: Math.max(0,z-offset), fraction, collider: original };
        break;
      }
    }
    return first;
  }
  function sight(a, b, list, radius = 0) {
    const point = e => {
      const projectile = e.projectile || e.owner;
      const z = Number.isFinite(e.impactZ) ? e.impactZ : height(e) + (projectile ? 0 : body(e).height * .55);
      const visualOffset = e.visualOffset ?? (Number.isFinite(e.visualZ) ? z-e.visualZ : projectile ? body(e).height*.59 : Number.isFinite(e.impactZ) ? 0 : body(e).height*.55);
      return { ...e, z, visualOffset };
    };
    return !trace(point(a), point(b), list, radius);
  }
  function resolveBodies(actors, moveActor) {
    const cells = new Map();
    for (const e of actors) {
      ensure(e);
      const cx = Math.floor(e.x / 96), cy = Math.floor(e.y / 96), r = body(e).radius;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const others = cells.get(`${e.world}:${cx + dx}:${cy + dy}`) || [];
        for (const b of others) {
          if (height(e) >= height(b) + body(b).height || height(b) >= height(e) + body(e).height) continue;
          if ((e.duelId || b.duelId) && e.duelId !== b.duelId) continue;
          let nx = e.x - b.x, ny = e.y - b.y, d = Math.hypot(nx, ny);
          const overlap = r + body(b).radius - d;
          if (overlap <= 0) continue;
          if (d < .01) { nx = String(e.id) < String(b.id) ? -1 : 1; ny = 0; d = 1; }
          nx /= d; ny /= d;
          const share = body(b).mass / (body(e).mass + body(b).mass);
          moveActor(e, nx * overlap * share, ny * overlap * share);
          moveActor(b, -nx * overlap * (1 - share), -ny * overlap * (1 - share));
          const relative = (e.vx - b.vx) * nx + (e.vy - b.vy) * ny;
          if (relative < 0) {
            e.vx -= relative * nx * share; e.vy -= relative * ny * share;
            b.vx += relative * nx * (1 - share); b.vy += relative * ny * (1 - share);
          }
        }
      }
      const key = `${e.world}:${cx}:${cy}`, cell = cells.get(key) || [];
      cell.push(e); cells.set(key, cell);
    }
  }
  return { GRAVITY, JUMP_HEIGHT, JUMP_WINDUP, STEP_HEIGHT, FLIGHT_HEIGHT, body, height, displayHeight, ensure, contact, parts, supportShape, colliders, surface, blocked, move, step, jump, takeoff, land, impulse, trace, sight, resolveBodies };
});
